import { ref, set, get, remove, onValue, type Unsubscribe } from 'firebase/database';
import { database } from './firebaseConfig';
import type { SpeechEvent, TimerSyncState } from '../types';

// Allowed characters in share IDs (alphanumeric, no ambiguous chars)
const SHARE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SHARE_ID_RE = /^[A-Za-z0-9]{4,16}$/;

function generateShareId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, b => SHARE_ID_CHARS[b % SHARE_ID_CHARS.length]).join('');
}

function validateShareId(shareId: string): boolean {
  return SHARE_ID_RE.test(shareId);
}

function isValidSharedEvent(data: unknown): data is SpeechEvent {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'string' && d.id.length <= 100 &&
    typeof d.title === 'string' && d.title.length <= 500 &&
    Array.isArray(d.segments) && d.segments.length <= 200
  );
}

function isValidTimerState(data: unknown): data is TimerSyncState {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.status === 'string' && d.status.length <= 20 &&
    typeof d.timeInSeconds === 'number' &&
    typeof d.lastUpdatedAt === 'number' &&
    (d.eventTitle == null || (typeof d.eventTitle === 'string' && d.eventTitle.length <= 500)) &&
    (d.segmentName == null || (typeof d.segmentName === 'string' && d.segmentName.length <= 500)) &&
    (d.activeAlertColor == null || (typeof d.activeAlertColor === 'string' && d.activeAlertColor.length <= 30))
  );
}

export async function publishEvent(event: SpeechEvent): Promise<string> {
  let shareId = event.shareId || generateShareId();

  // Check for collision if generating a new ID (retry up to 5 times)
  if (!event.shareId) {
    for (let i = 0; i < 5; i++) {
      const existing = await get(ref(database, `shared/${shareId}`));
      if (!existing.exists()) break;
      shareId = generateShareId();
    }
  }

  const eventRef = ref(database, `shared/${shareId}/event`);
  await set(eventRef, {
    id: event.id,
    title: event.title,
    segments: event.segments.map(s => ({
      id: s.id,
      name: s.name,
      durationSeconds: s.durationSeconds,
      mode: s.mode,
      color: s.color,
    })),
    scheduledStartTime: event.scheduledStartTime ?? null,
  });
  return shareId;
}

export async function publishTimerState(shareId: string, state: TimerSyncState): Promise<void> {
  if (!validateShareId(shareId)) return;
  const stateRef = ref(database, `shared/${shareId}/timerState`);
  await set(stateRef, state);
}

export function subscribeToTimerState(
  shareId: string,
  callback: (state: TimerSyncState | null) => void,
): Unsubscribe {
  if (!validateShareId(shareId)) {
    callback(null);
    return () => {};
  }
  const stateRef = ref(database, `shared/${shareId}/timerState`);
  return onValue(stateRef, (snapshot) => {
    const val = snapshot.val();
    callback(isValidTimerState(val) ? val : null);
  });
}

export async function fetchSharedEvent(shareId: string): Promise<SpeechEvent | null> {
  if (!validateShareId(shareId)) return null;
  const eventRef = ref(database, `shared/${shareId}/event`);
  const snapshot = await get(eventRef);
  const val = snapshot.val();
  return isValidSharedEvent(val) ? val : null;
}

export async function removeSharedEvent(shareId: string): Promise<void> {
  if (!validateShareId(shareId)) return;
  const sharedRef = ref(database, `shared/${shareId}`);
  await remove(sharedRef);
}
