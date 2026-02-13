// ========== Core Types ==========

export type TimerMode = 'countdown' | 'countup';
export type SegmentStatus = 'idle' | 'running' | 'paused' | 'completed';
export type Screen = 'eventList' | 'eventSettings' | 'segmentSettings' | 'timerRunning';

// ========== Color Alerts ==========

export interface SpeechColorAlert {
  id: string;
  timeInSeconds: number;   // Trigger at this many seconds remaining (countdown) or elapsed (countup)
  color: string;           // Hex color
  background: boolean;     // Change background color
  flash: boolean;
  sound: boolean;
  label: string;
}

// ========== Segment ==========

export interface Segment {
  id: string;
  name: string;
  durationSeconds: number;       // For countdown: total duration. For countup: 0 = unlimited
  mode: TimerMode;
  colorAlerts: SpeechColorAlert[];
  soundEnabled: boolean;         // Completion sound
  flashEnabled: boolean;         // Completion flash
  tickEnabled: boolean;
}

// ========== Event ==========

export interface SpeechEvent {
  id: string;
  title: string;
  date: string;                  // ISO date string e.g. '2026-01-10'
  startTime: string;             // HH:mm e.g. '13:00'
  endTime: string;               // HH:mm e.g. '17:00'
  segments: Segment[];
  scheduledStartTime: number | null;  // Unix timestamp for scheduled auto-start
}

// ========== App State ==========

export interface AppState {
  events: SpeechEvent[];
  currentScreen: Screen;
  activeEventId: string | null;
  activeSegmentId: string | null;
  runningEventId: string | null;
  runningSegmentIndex: number;
  darkMode: boolean;
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

// ========== Default Color Alerts ==========

export const DEFAULT_COLOR_ALERTS: SpeechColorAlert[] = [
  { id: crypto.randomUUID(), timeInSeconds: 300, color: '#EAB308', background: true, flash: false, sound: false, label: '5 min' },
  { id: crypto.randomUUID(), timeInSeconds: 60,  color: '#F97316', background: true, flash: true,  sound: false, label: '1 min' },
  { id: crypto.randomUUID(), timeInSeconds: 10,  color: '#EF4444', background: true, flash: true,  sound: true,  label: '10 sec' },
];

// ========== Defaults ==========

export const DEFAULT_SEGMENT: Omit<Segment, 'id'> = {
  name: 'New Speech',
  durationSeconds: 300,
  mode: 'countdown',
  colorAlerts: DEFAULT_COLOR_ALERTS,
  soundEnabled: true,
  flashEnabled: false,
  tickEnabled: false,
};

export const createDefaultSegment = (): Segment => ({
  ...DEFAULT_SEGMENT,
  id: crypto.randomUUID(),
  colorAlerts: [
    { id: crypto.randomUUID(), timeInSeconds: 300, color: '#EAB308', background: true, flash: false, sound: false, label: '5 min' },
    { id: crypto.randomUUID(), timeInSeconds: 60,  color: '#F97316', background: true, flash: true,  sound: false, label: '1 min' },
    { id: crypto.randomUUID(), timeInSeconds: 10,  color: '#EF4444', background: true, flash: true,  sound: true,  label: '10 sec' },
  ],
});

export const createDefaultEvent = (): SpeechEvent => {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title: 'New Event',
    date: now.toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    segments: [],
    scheduledStartTime: null,
  };
};

// ========== Helpers ==========

export const formatDuration = (totalSeconds: number): { h: number; m: number; s: number } => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
};

export const formatDurationString = (totalSeconds: number): string => {
  const { h, m, s } = formatDuration(totalSeconds);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};
