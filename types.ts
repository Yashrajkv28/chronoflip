// ========== Core Types ==========

export type TimerMode = 'countdown' | 'countup';
export type SegmentStatus = 'idle' | 'running' | 'paused' | 'completed';
export type Screen = 'eventList' | 'eventSettings' | 'segmentSettings' | 'timerRunning';



// ========== Segment ==========

export interface Segment {
  id: string;
  name: string;
  durationSeconds: number;       // For countdown: total duration. For countup: 0 = unlimited
  mode: TimerMode;
  color: string;                 // Background color for this segment (hex)
  soundEnabled: boolean;         // Completion sound
  flashEnabled: boolean;         // Completion flash
  tickEnabled: boolean;
  groupId?: string;               // undefined = ungrouped/loose timer
}

// ========== Timer Group ==========

export interface TimerGroup {
  id: string;
  name: string;
}

// ========== Event ==========

export interface SpeechEvent {
  id: string;
  title: string;
  venueName?: string;              // optional venue/location name
  date: string;                  // ISO date string e.g. '2026-01-10'
  startTime: string;             // HH:mm e.g. '13:00'
  endTime: string;               // HH:mm e.g. '17:00'
  segments: Segment[];
  groups?: TimerGroup[];           // group metadata (id + name)
  scheduledStartTime: number | null;  // Unix timestamp for scheduled auto-start
  shareId?: string;              // Share ID for QR code viewing
  updatedAt: number;             // Last modified timestamp for sync conflict resolution
}

// ========== Shared Event (viewer subset — matches GraphQL query fields) ==========

export type SharedSegment = Pick<Segment, 'id' | 'name' | 'durationSeconds' | 'mode' | 'color' | 'groupId'>;

export interface SharedEvent {
  id: string;
  title: string;
  venueName?: string;
  segments: SharedSegment[];
  groups?: { id: string; name: string }[];
  scheduledStartTime: number | null;
}

// ========== Timer Sync (real-time viewer) ==========

export interface TimerSyncState {
  status: 'waiting' | 'running' | 'paused' | 'completed';
  currentSegmentIndex: number;
  timeInSeconds: number;
  segmentName: string;
  segmentMode: TimerMode;
  totalSegments: number;
  activeAlertColor: string | null;
  isFlashing: boolean;           // true during blocking flash
  lastUpdatedAt: number;
  eventTitle: string;
  scheduledStartTime: number | null;
  activeGroupId?: string;          // which group is running (undefined = all/loose)
}

// ========== Viewer Commands (remote control) ==========

export interface ViewerCommand {
  type: 'start' | 'pause' | 'restart';
  timestamp: number;             // Date.now() when command was sent
}

// ========== App State ==========

export interface AppState {
  events: SpeechEvent[];
  currentScreen: Screen;
  activeEventId: string | null;
  activeSegmentId: string | null;
  runningEventId: string | null;
  runningSegmentIndex: number;
  runningGroupId: string | null;           // which group is running
  runningGroupSegmentIndices: number[];    // segment indices for the active group
}

// ========== Color Palette ==========

export const SEGMENT_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#1F2937', // Dark
] as const;

// ========== Defaults ==========

export const DEFAULT_SEGMENT: Omit<Segment, 'id'> = {
  name: 'New Speech',
  durationSeconds: 300,
  mode: 'countdown',
  color: '#3B82F6',
  soundEnabled: true,
  flashEnabled: false,
  tickEnabled: false,
};

export const createDefaultSegment = (): Segment => ({
  ...DEFAULT_SEGMENT,
  id: crypto.randomUUID(),
});

export const createDefaultGroup = (name = 'New Group'): TimerGroup => ({
  id: crypto.randomUUID(),
  name,
});

export const createDefaultEvent = (): SpeechEvent => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return {
    id: crypto.randomUUID(),
    title: 'New Event',
    date: `${yyyy}-${mm}-${dd}`,
    startTime: '09:00',
    endTime: '10:00',
    segments: [],
    scheduledStartTime: null,
    updatedAt: Date.now(),
  };
};

// ========== Helpers ==========

export const formatDuration = (totalSeconds: number): { h: number; m: number; s: number } => {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return { h, m, s };
};

export const formatDurationString = (totalSeconds: number): string => {
  const { h, m, s } = formatDuration(totalSeconds);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};
