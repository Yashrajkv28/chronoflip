import { generateClient } from 'aws-amplify/api';
import type { SpeechEvent, SharedEvent, TimerSyncState, ViewerCommand } from '../types';
import { getSharedEvent } from './graphql/queries';
import {
  publishEventMutation,
  publishTimerStateMutation,
  publishCommandMutation,
  clearCommandMutation,
  removeSharedEventMutation,
} from './graphql/mutations';
import { onTimerStateUpdate, onCommandUpdate } from './graphql/subscriptions';

// Lazy client — ensures Amplify.configure() has run before first use
let _syncClient: ReturnType<typeof generateClient> | null = null;
function getSyncClient() {
  if (!_syncClient) _syncClient = generateClient();
  return _syncClient;
}

// Allowed characters in share IDs (excludes ambiguous: I, O, 0, 1)
const SHARE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SHARE_ID_RE = /^[A-HJ-NP-Za-km-z2-9]{4,16}$/;

const ALLOWED_COMMAND_TYPES: ViewerCommand['type'][] = ['start', 'pause', 'restart'];

type Unsubscribe = () => void;

function generateShareId(): string {
  // Rejection sampling eliminates modulo bias (SHARE_ID_CHARS.length=57 doesn't divide 256)
  const maxValid = 256 - (256 % SHARE_ID_CHARS.length);
  const result: string[] = [];
  while (result.length < 8) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < maxValid && result.length < 8) {
        result.push(SHARE_ID_CHARS[b % SHARE_ID_CHARS.length]);
      }
    }
  }
  return result.join('');
}

function validateShareId(shareId: string): boolean {
  return SHARE_ID_RE.test(shareId);
}

function isValidTimerState(val: unknown): val is TimerSyncState {
  if (!val || typeof val !== 'object') return false;
  const v = val as Record<string, unknown>;
  const validStatuses = ['waiting', 'running', 'paused', 'completed'];
  return (
    typeof v.status === 'string' && validStatuses.includes(v.status as string) &&
    Number.isFinite(v.currentSegmentIndex) &&
    Number.isFinite(v.timeInSeconds) &&
    Number.isFinite(v.totalSegments) &&
    Number.isFinite(v.lastUpdatedAt) &&
    typeof v.segmentName === 'string' &&
    typeof v.eventTitle === 'string' &&
    typeof v.segmentMode === 'string' && ['countdown', 'countup'].includes(v.segmentMode as string) &&
    (v.activeAlertColor === null || typeof v.activeAlertColor === 'string') &&
    typeof v.isFlashing === 'boolean' &&
    (v.scheduledStartTime === null || Number.isFinite(v.scheduledStartTime))
  );
}

// Throws on failure — caller must catch
export async function publishEvent(event: SpeechEvent): Promise<string> {
  if (event.segments.length > 200) {
    throw new Error('Too many segments (max 200)');
  }
  const shareId = (event.shareId && validateShareId(event.shareId))
    ? event.shareId
    : generateShareId();

  await getSyncClient().graphql({
    query: publishEventMutation,
    variables: {
      shareId,
      event: {
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
      },
    },
    authMode: 'userPool',
  });

  return shareId;
}

export async function publishTimerState(shareId: string, state: TimerSyncState): Promise<void> {
  if (!validateShareId(shareId)) return;
  try {
    await getSyncClient().graphql({
      query: publishTimerStateMutation,
      variables: {
        input: {
          shareId,
          status: state.status,
          currentSegmentIndex: state.currentSegmentIndex,
          timeInSeconds: state.timeInSeconds,
          segmentName: state.segmentName,
          segmentMode: state.segmentMode,
          totalSegments: state.totalSegments,
          activeAlertColor: state.activeAlertColor,
          isFlashing: state.isFlashing,
          lastUpdatedAt: state.lastUpdatedAt,
          eventTitle: state.eventTitle,
          scheduledStartTime: state.scheduledStartTime,
        },
      },
      authMode: 'userPool',
    });
  } catch (err) {
    console.warn('publishTimerState failed:', err);
  }
}

export function subscribeToTimerState(
  shareId: string,
  callback: (state: TimerSyncState | null) => void,
): Unsubscribe {
  if (!validateShareId(shareId)) {
    callback(null);
    return () => {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Amplify subscription type is complex
  let sub: any = null;
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;

  function connect() {
    // Clean up previous subscription before creating a new one
    sub?.unsubscribe();
    sub = getSyncClient().graphql({
      query: onTimerStateUpdate,
      variables: { shareId },
      authMode: 'apiKey',
    }).subscribe({
      next: ({ data }: any) => {
        retryCount = 0;
        const val = data?.onTimerStateUpdate;
        callback(isValidTimerState(val) ? val : null);
      },
      error: (err: any) => {
        console.error('Timer state subscription error:', err);
        if (!cancelled) {
          const delay = Math.min(3000 * Math.pow(2, retryCount), 30000);
          if (retryCount < 10) retryCount++;
          retryTimer = setTimeout(() => { if (!cancelled) connect(); }, delay);
        }
      },
    });
  }

  connect();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    sub?.unsubscribe();
  };
}

function isValidSharedEvent(val: unknown): val is SharedEvent {
  if (!val || typeof val !== 'object') return false;
  const v = val as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.title !== 'string' || !Array.isArray(v.segments)) return false;
  return v.segments.length <= 200 && v.segments.every(
    (s: unknown) =>
      s !== null && typeof s === 'object' &&
      typeof (s as Record<string, unknown>).id === 'string' &&
      typeof (s as Record<string, unknown>).name === 'string' &&
      Number.isFinite((s as Record<string, unknown>).durationSeconds) &&
      ((s as Record<string, unknown>).durationSeconds as number) >= 0 &&
      typeof (s as Record<string, unknown>).mode === 'string' &&
      ['countdown', 'countup'].includes((s as Record<string, unknown>).mode as string) &&
      typeof (s as Record<string, unknown>).color === 'string'
  );
}

export async function fetchSharedEvent(shareId: string): Promise<SharedEvent | null> {
  if (!validateShareId(shareId)) return null;
  try {
    const result: any = await getSyncClient().graphql({
      query: getSharedEvent,
      variables: { shareId },
      authMode: 'apiKey',
    });
    const event = result.data?.getSharedEvent;
    return isValidSharedEvent(event) ? event : null;
  } catch (err) {
    console.warn('fetchSharedEvent failed:', err);
    return null;
  }
}

// Throws on failure — caller must catch
export async function removeSharedEvent(shareId: string): Promise<void> {
  if (!validateShareId(shareId)) return;
  await getSyncClient().graphql({
    query: removeSharedEventMutation,
    variables: { shareId },
    authMode: 'userPool',
  });
}

export async function publishCommand(shareId: string, command: ViewerCommand): Promise<void> {
  if (!validateShareId(shareId)) return;
  if (!ALLOWED_COMMAND_TYPES.includes(command.type)) return;
  try {
    await getSyncClient().graphql({
      query: publishCommandMutation,
      variables: {
        input: { shareId, type: command.type, timestamp: command.timestamp },
      },
      authMode: 'apiKey',
    });
  } catch (err) {
    console.warn('publishCommand failed:', err);
  }
}

export function subscribeToCommand(
  shareId: string,
  callback: (command: ViewerCommand | null) => void,
): Unsubscribe {
  if (!validateShareId(shareId)) {
    callback(null);
    return () => {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Amplify subscription type is complex
  let sub: any = null;
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;

  function connect() {
    // Clean up previous subscription before creating a new one
    sub?.unsubscribe();
    sub = getSyncClient().graphql({
      query: onCommandUpdate,
      variables: { shareId },
      authMode: 'apiKey',
    }).subscribe({
      next: ({ data }: any) => {
        retryCount = 0;
        const val = data?.onCommandUpdate;
        if (
          val &&
          typeof val.type === 'string' &&
          Number.isFinite(val.timestamp) &&
          ALLOWED_COMMAND_TYPES.includes(val.type as ViewerCommand['type'])
        ) {
          callback(val as ViewerCommand);
        } else {
          callback(null);
        }
      },
      error: (err: any) => {
        console.error('Command subscription error:', err);
        if (!cancelled) {
          const delay = Math.min(3000 * Math.pow(2, retryCount), 30000);
          if (retryCount < 10) retryCount++;
          retryTimer = setTimeout(() => { if (!cancelled) connect(); }, delay);
        }
      },
    });
  }

  connect();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    sub?.unsubscribe();
  };
}

// Throws on failure — caller must catch
export async function clearCommand(shareId: string): Promise<void> {
  if (!validateShareId(shareId)) return;
  await getSyncClient().graphql({
    query: clearCommandMutation,
    variables: { shareId },
    authMode: 'userPool',
  });
}
