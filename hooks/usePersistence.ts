import { generateClient } from 'aws-amplify/api';
import type { SpeechEvent, AppState } from '../types';
import { listUserEvents } from '../services/graphql/queries';
import {
  saveUserEventMutation,
  deleteUserEventMutation,
} from '../services/graphql/mutations';

const EVENTS_KEY = 'chronoflip-v2-events';
const DELETED_KEY = 'chronoflip-v2-deleted';

// Lazy client initialization — ensures Amplify.configure() has run
let _client: ReturnType<typeof generateClient> | null = null;
function getClient() {
  if (!_client) _client = generateClient();
  return _client;
}

// Reset client on sign-out (prevents stale auth context across sessions)
export function resetPersistenceClient(): void {
  _client = null;
}

// ========== localStorage (cache layer) ==========

function loadEventsFromCache(): SpeechEvent[] {
  try {
    const data = localStorage.getItem(EVENTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        let migrated = false;
        const events = parsed.map((event: any) => {
          if (!('updatedAt' in event)) migrated = true;
          const result = {
            ...event,
            updatedAt: Number(event.updatedAt) || 0,
            segments: (event.segments || []).map((seg: any) => {
              const needsMigration = !('color' in seg) || !('tickEnabled' in seg);
              if (needsMigration) migrated = true;
              return {
                ...seg,
                color: seg.color ?? seg.colorAlerts?.[0]?.color ?? '#3B82F6',
                tickEnabled: seg.tickEnabled ?? false,
              };
            }),
          };
          return result;
        });
        // Validate cached events — reject entries missing required fields
        const valid = events.filter((e: any) =>
          e && typeof e.id === 'string' && typeof e.title === 'string' && Array.isArray(e.segments)
        );
        // Re-persist migrated/cleaned data
        if (migrated || valid.length !== events.length) {
          try { localStorage.setItem(EVENTS_KEY, JSON.stringify(valid)); } catch { /* ignore */ }
        }
        return valid;
      }
    }
  } catch (e) {
    console.warn('Failed to load events from cache:', e);
  }
  return [];
}

function saveEventsToCache(events: SpeechEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn('Failed to save events to cache:', e);
  }
}

// ========== Deleted event tracking (survives across sync cycles) ==========

export function recordDeletedEvent(eventId: string): void {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    const deleted: Record<string, number> = raw ? JSON.parse(raw) : {};
    deleted[eventId] = Date.now();
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
  } catch { /* ignore */ }
}

function getDeletedEventIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) {
      const deleted: Record<string, number> = JSON.parse(raw);
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30-day TTL
      const pruned: Record<string, number> = {};
      let didPrune = false;
      for (const [id, ts] of Object.entries(deleted)) {
        if (ts >= cutoff) {
          pruned[id] = ts;
        } else {
          didPrune = true;
        }
      }
      if (didPrune) {
        try { localStorage.setItem(DELETED_KEY, JSON.stringify(pruned)); } catch { /* ignore */ }
      }
      return new Set(Object.keys(pruned));
    }
  } catch { /* ignore */ }
  return new Set();
}

function clearDeletedEvents(idsToRemove: string[]): void {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return;
    const deleted: Record<string, number> = JSON.parse(raw);
    for (const id of idsToRemove) delete deleted[id];
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
  } catch { /* ignore */ }
}

// ========== DynamoDB (source of truth) ==========

interface CloudEventItem {
  event: SpeechEvent;
  updatedAt: number;
}

interface FetchCloudResult {
  items: CloudEventItem[];
  failed: boolean;
}

async function fetchCloudItems(userId: string): Promise<FetchCloudResult> {
  if (!userId) return { items: [], failed: false };
  try {
    const result: any = await getClient().graphql({
      query: listUserEvents,
      variables: { userId },
      authMode: 'userPool',
    });
    const rawItems = result.data?.listUserEvents ?? [];
    const items = rawItems.reduce((acc: CloudEventItem[], item: any) => {
      try {
        const event = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        if (event && event.id && Array.isArray(event.segments)) {
          acc.push({ event: event as SpeechEvent, updatedAt: Number(item.updatedAt) || 0 });
        }
      } catch (e) {
        console.warn('Failed to parse cloud event data:', e);
      }
      return acc;
    }, []);
    return { items, failed: false };
  } catch (e) {
    console.warn('Failed to fetch events from cloud:', e);
    return { items: [], failed: true };
  }
}

// Returns true on success, false on failure
export async function saveEventToCloud(userId: string, event: SpeechEvent): Promise<boolean> {
  if (!userId) return false;
  try {
    await getClient().graphql({
      query: saveUserEventMutation,
      variables: {
        input: {
          userId,
          eventId: event.id,
          data: JSON.stringify(event),
          updatedAt: event.updatedAt || Date.now(),
        },
      },
      authMode: 'userPool',
    });
    return true;
  } catch (e) {
    console.warn('Failed to save event to cloud:', e);
    return false;
  }
}

export async function deleteEventFromCloud(userId: string, eventId: string): Promise<void> {
  if (!userId) return;
  try {
    await getClient().graphql({
      query: deleteUserEventMutation,
      variables: { userId, eventId },
      authMode: 'userPool',
    });
  } catch (e) {
    console.warn('Failed to delete event from cloud:', e);
  }
}

// ========== Sync: merge cloud <-> cache ==========

export async function syncEvents(userId: string, localEvents: SpeechEvent[]): Promise<SpeechEvent[]> {
  const { items: cloudItems, failed } = await fetchCloudItems(userId);

  // On network failure, don't touch anything — return local as-is
  if (failed) return localEvents;

  const deletedIds = getDeletedEventIds();

  if (cloudItems.length === 0 && localEvents.length > 0) {
    // First cloud sync — upload only non-deleted local events
    const toUpload = localEvents.filter(e => !deletedIds.has(e.id));
    await Promise.all(toUpload.map(event => saveEventToCloud(userId, event)));
    clearDeletedEvents([...deletedIds]);
    return toUpload;
  }

  if (cloudItems.length === 0 && localEvents.length === 0) {
    clearDeletedEvents([...deletedIds]);
    return [];
  }

  // Merge preserving local event order (local first, then cloud-only appended)
  const cloudMap = new Map(cloudItems.map(ci => [ci.event.id, ci]));
  const merged: SpeechEvent[] = [];
  const cloudUploads: SpeechEvent[] = [];
  const processedCloudIds = new Set<string>();

  // First pass: iterate local events to preserve their order
  for (const local of localEvents) {
    if (deletedIds.has(local.id)) continue;
    const ci = cloudMap.get(local.id);
    if (ci) {
      processedCloudIds.add(local.id);
      // Both exist — last-write-wins using updatedAt
      if ((local.updatedAt || 0) > ci.updatedAt) {
        merged.push(local);
        cloudUploads.push(local);
      } else {
        merged.push(ci.event);
      }
    } else {
      // Local-only — keep and upload
      merged.push(local);
      cloudUploads.push(local);
    }
  }

  // Second pass: append cloud-only events (not in local, not deleted)
  for (const [id, ci] of cloudMap) {
    if (!processedCloudIds.has(id) && !deletedIds.has(id)) {
      merged.push(ci.event);
    }
  }

  // Delete tombstoned events from cloud
  for (const [id] of cloudMap) {
    if (deletedIds.has(id)) {
      deleteEventFromCloud(userId, id).catch(() => {});
    }
  }

  // Upload local changes to cloud
  if (cloudUploads.length > 0) {
    await Promise.all(cloudUploads.map(event => saveEventToCloud(userId, event)));
  }

  // Clean up deletion tracking: keep IDs still in cloud (delete may have failed)
  const stillInCloud = new Set(cloudItems.map(ci => ci.event.id));
  clearDeletedEvents([...deletedIds].filter(id => !stillInCloud.has(id)));

  // Don't call saveEventsToCache here — App.tsx effect handles it on state change
  return merged;
}

// ========== Pending saves (survives page close via localStorage) ==========

const PENDING_SAVE_KEY = 'chronoflip-v2-pending-saves';

export function persistPendingSaves(events: SpeechEvent[]): void {
  try {
    if (events.length === 0) {
      localStorage.removeItem(PENDING_SAVE_KEY);
    } else {
      localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(events));
    }
  } catch { /* ignore */ }
}

export function loadAndClearPendingSaves(): SpeechEvent[] {
  try {
    const raw = localStorage.getItem(PENDING_SAVE_KEY);
    localStorage.removeItem(PENDING_SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((e: any) =>
          e && typeof e.id === 'string' && typeof e.title === 'string' && Array.isArray(e.segments)
        );
      }
    }
  } catch { /* ignore */ }
  return [];
}

// ========== Public API (same interface as before) ==========

export function loadAppState(): AppState {
  const events = loadEventsFromCache();
  return {
    events,
    currentScreen: 'eventList',
    activeEventId: null,
    activeSegmentId: null,
    runningEventId: null,
    runningSegmentIndex: 0,
  };
}

export function saveEvents(events: SpeechEvent[]): void {
  saveEventsToCache(events);
}
