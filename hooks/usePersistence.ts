import { generateClient } from 'aws-amplify/api';
import type { SpeechEvent, AppState } from '../types';
import { listUserEvents } from '../services/graphql/queries';
import {
  saveUserEventMutation,
  deleteUserEventMutation,
} from '../services/graphql/mutations';
import { onUserEventChange } from '../services/graphql/subscriptions';

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

// ========== Last-sync timestamp (detects remote deletions) ==========

const LAST_SYNC_KEY = 'chronoflip-v2-last-synced';

function getLastSyncedAt(): number {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? Number(raw) : 0;
  } catch { return 0; }
}

function setLastSyncedAt(): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

// ========== DynamoDB (source of truth) ==========

interface CloudEventItem {
  event: SpeechEvent;
  updatedAt: number;
}

interface FetchCloudResult {
  items: CloudEventItem[];
  rawCount: number;           // total items returned from cloud (including corrupted)
  corruptedIds: string[];     // eventIds that couldn't be parsed — will be garbage-collected
  failed: boolean;
}

async function fetchCloudItems(userId: string): Promise<FetchCloudResult> {
  if (!userId) return { items: [], rawCount: 0, corruptedIds: [], failed: false };
  try {
    console.log('[SYNC] Fetching cloud events for userId:', userId);
    const result: any = await getClient().graphql({
      query: listUserEvents,
      variables: { userId },
      authMode: 'userPool',
    });
    console.log('[SYNC] Raw cloud response:', JSON.stringify(result.data));
    const rawItems = result.data?.listUserEvents ?? [];
    const corruptedIds: string[] = [];
    const items = rawItems.reduce((acc: CloudEventItem[], item: any) => {
      try {
        let parsed = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        // Handle double-encoded data: AWSJSON may return the inner JSON string
        // which needs a second parse to get the actual event object
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        if (parsed && parsed.id && Array.isArray(parsed.segments)) {
          acc.push({ event: parsed as SpeechEvent, updatedAt: Number(item.updatedAt) || 0 });
        } else if (item.eventId) {
          corruptedIds.push(item.eventId);
        }
      } catch (e) {
        console.warn('[SYNC] Corrupted cloud event, will delete:', item.eventId);
        if (item.eventId) corruptedIds.push(item.eventId);
      }
      return acc;
    }, []);
    console.log('[SYNC] Parsed cloud items:', items.length, '| corrupted:', corruptedIds.length);
    return { items, rawCount: rawItems.length, corruptedIds, failed: false };
  } catch (e) {
    console.error('[SYNC] FAILED to fetch events from cloud:', e);
    return { items: [], rawCount: 0, corruptedIds: [], failed: true };
  }
}

// Returns true on success, false on failure
export async function saveEventToCloud(userId: string, event: SpeechEvent): Promise<boolean> {
  if (!userId) return false;
  try {
    console.log('[SAVE] Saving event to cloud:', event.id, event.title);
    const result = await getClient().graphql({
      query: saveUserEventMutation,
      variables: {
        input: {
          userId,
          eventId: event.id,
          // Double-stringify: AWSJSON deserializes the outer JSON layer into a
          // native object. By wrapping in an extra JSON.stringify, the resolver
          // receives a plain String (the inner JSON) instead of a Map, which
          // prevents the VTL resolver from corrupting it via Java Map.toString().
          data: JSON.stringify(JSON.stringify(event)),
          updatedAt: event.updatedAt || Date.now(),
        },
      },
      authMode: 'userPool',
    });
    console.log('[SAVE] Success:', JSON.stringify(result));
    return true;
  } catch (e) {
    console.error('[SAVE] FAILED to save event to cloud:', e);
    return false;
  }
}

export async function deleteEventFromCloud(userId: string, eventId: string): Promise<void> {
  if (!userId) return;
  try {
    console.log('[DELETE] Deleting event from cloud:', eventId);
    await getClient().graphql({
      query: deleteUserEventMutation,
      variables: { userId, eventId },
      authMode: 'userPool',
    });
    console.log('[DELETE] Success:', eventId);
  } catch (e) {
    console.error('[DELETE] FAILED:', eventId, e);
  }
}

// ========== Sync: merge cloud <-> cache ==========

export async function syncEvents(userId: string, localEvents: SpeechEvent[]): Promise<SpeechEvent[]> {
  const { items: cloudItems, rawCount, corruptedIds, failed } = await fetchCloudItems(userId);

  // On network failure, don't touch anything — return local as-is
  if (failed) return localEvents;

  // Garbage-collect corrupted cloud entries (e.g., old pre-migration data)
  if (corruptedIds.length > 0) {
    console.log('[SYNC] Garbage-collecting corrupted entries:', corruptedIds);
    await Promise.all(corruptedIds.map(id => deleteEventFromCloud(userId, id)));
  }

  const deletedIds = getDeletedEventIds();
  const lastSync = getLastSyncedAt();
  // Use rawCount (not cloudItems.length) to detect whether cloud has ever been used.
  // Corrupted items that can't be parsed still mean "cloud is not empty".
  const cloudHasData = rawCount > 0;

  if (!cloudHasData && localEvents.length > 0) {
    if (lastSync > 0) {
      // We've synced before but cloud is empty — events were deleted remotely.
      // Only keep/upload local events created AFTER the last sync.
      const newLocal = localEvents.filter(e =>
        !deletedIds.has(e.id) && (e.updatedAt || 0) > lastSync
      );
      if (newLocal.length > 0) {
        await Promise.all(newLocal.map(event => saveEventToCloud(userId, event)));
      }
      clearDeletedEvents([...deletedIds]);
      setLastSyncedAt();
      return newLocal;
    }
    // Truly first cloud sync — upload only non-deleted local events
    const toUpload = localEvents.filter(e => !deletedIds.has(e.id));
    await Promise.all(toUpload.map(event => saveEventToCloud(userId, event)));
    clearDeletedEvents([...deletedIds]);
    setLastSyncedAt();
    return toUpload;
  }

  if (!cloudHasData && localEvents.length === 0) {
    clearDeletedEvents([...deletedIds]);
    setLastSyncedAt();
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
    } else if (lastSync === 0 || (local.updatedAt || 0) > lastSync) {
      // Genuinely new local event (created/modified after last sync) — keep and upload
      merged.push(local);
      cloudUploads.push(local);
    }
    // else: event existed before last sync but is gone from cloud → deleted remotely, drop it
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

  // Record sync timestamp so future syncs can detect remote deletions
  setLastSyncedAt();

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

// ========== Real-time subscription (cross-browser sync) ==========

export interface UserEventChangeNotification {
  userId: string;
  eventId: string;
  updatedAt?: number;
  deleted?: boolean;
}

type Unsubscribe = () => void;

/**
 * Subscribe to real-time event changes for a user.
 * Calls `onChanged` whenever another browser saves or deletes an event.
 * Follows the same retry/backoff pattern as subscribeToTimerState in syncService.
 */
export function subscribeToUserEventChanges(
  userId: string,
  onChanged: (notification: UserEventChangeNotification) => void,
): Unsubscribe {
  if (!userId) return () => {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sub: any = null;
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;

  function connect() {
    sub?.unsubscribe();
    sub = getClient().graphql({
      query: onUserEventChange,
      variables: { userId },
      authMode: 'userPool',
    }).subscribe({
      next: ({ data }: any) => {
        retryCount = 0;
        const val = data?.onUserEventChange;
        if (val && typeof val.eventId === 'string') {
          console.log('[REALTIME] Event change:', val.eventId, val.deleted ? 'deleted' : 'saved');
          onChanged(val as UserEventChangeNotification);
        }
      },
      error: (err: any) => {
        console.error('[REALTIME] Subscription error:', JSON.stringify(err, null, 2));
        if (!cancelled) {
          const delay = Math.min(3000 * Math.pow(2, retryCount), 30000);
          if (retryCount < 10) retryCount++;
          retryTimer = setTimeout(() => { if (!cancelled) connect(); }, delay);
        }
      },
    });
  }

  connect();
  console.log('[REALTIME] Subscribed to event changes for user:', userId);

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    sub?.unsubscribe();
    console.log('[REALTIME] Unsubscribed from event changes');
  };
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
    runningGroupId: null,
    runningGroupSegmentIndices: [],
  };
}

export function saveEvents(events: SpeechEvent[]): void {
  saveEventsToCache(events);
}
