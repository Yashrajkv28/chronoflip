// Orb/appearance configuration extracted from FlipClockTimer for shared use

export type TimerMode = 'countdown' | 'countup' | 'hybrid';
export type AppMode = 'clock' | 'countup' | 'countdown' | 'hybrid';

export interface ColorAlert {
  id: string;
  timeInSeconds: number;
  color: string;
  flash: boolean;
  background: boolean;
  sound: boolean;
  label: string;
}

export interface TimerConfig {
  mode: TimerMode;
  initialTimeInSeconds: number;
  colorAlerts: ColorAlert[];
  qaColorAlerts: ColorAlert[];
  showHours: boolean;
  showDays: boolean;
  playTickSound: boolean;
  playAlertSound: boolean;
  delayedStartSeconds: number;
  scheduledStartTime: number | null;
  qaTimeInSeconds: number;
  orbColors: [string, string, string];
  orbOpacities: [number, number, number];
  countupLimitSeconds: number;
}

const DEFAULT_ALERTS: ColorAlert[] = [
  { id: '1', timeInSeconds: 300, color: '#EAB308', flash: false, background: false, sound: true, label: '5 minutes' },
  { id: '2', timeInSeconds: 60, color: '#F97316', flash: true, background: false, sound: true, label: '1 minute' },
  { id: '3', timeInSeconds: 10, color: '#EF4444', flash: true, background: false, sound: true, label: '10 seconds' },
];

const DEFAULT_CONFIG: TimerConfig = {
  mode: 'countdown',
  initialTimeInSeconds: 300,
  colorAlerts: DEFAULT_ALERTS,
  qaColorAlerts: [],
  showHours: true,
  showDays: false,
  playTickSound: false,
  playAlertSound: true,
  delayedStartSeconds: 0,
  scheduledStartTime: null,
  qaTimeInSeconds: 0,
  orbColors: ['#A855F7', '#3B82F6', '#6366F1'],
  orbOpacities: [30, 25, 25],
  countupLimitSeconds: 0,
};

const STORAGE_KEY = 'chronoflip-config';

const TAILWIND_TO_HEX: Record<string, string> = {
  'text-green-500': '#22C55E', 'text-yellow-500': '#EAB308',
  'text-orange-500': '#F97316', 'text-red-500': '#EF4444',
  'text-blue-500': '#3B82F6', 'text-purple-500': '#A855F7',
};

const migrateAlertColors = (alerts: any[]): ColorAlert[] =>
  alerts.map(a => ({
    ...a,
    color: a.colorClass ? (TAILWIND_TO_HEX[a.colorClass] || '#EAB308') : (a.color || '#EAB308'),
    background: a.background ?? false,
  }));

export const loadConfig = (): TimerConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.mode && typeof parsed.initialTimeInSeconds === 'number') {
        const merged = { ...DEFAULT_CONFIG, ...parsed };
        merged.colorAlerts = migrateAlertColors(merged.colorAlerts);
        merged.qaColorAlerts = migrateAlertColors(merged.qaColorAlerts || []);
        return merged;
      }
    }
  } catch (e) {
    console.warn('Failed to load saved config:', e);
  }
  return DEFAULT_CONFIG;
};

export const saveConfig = (config: TimerConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save config:', e);
  }
};
