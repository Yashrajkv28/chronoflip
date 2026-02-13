import type { SpeechEvent, AppState, SpeechColorAlert } from '../types';

const EVENTS_KEY = 'chronoflip-v2-events';
const DARKMODE_KEY = 'chronoflip-v2-darkmode';

// Old v1 key for migration
const V1_CONFIG_KEY = 'chronoflip-config';
const V1_DARKMODE_KEY = 'chronoflip-darkmode';

export function loadAppState(): AppState {
  let darkMode = false;

  // Load dark mode preference (try v2 first, then v1, then system)
  const v2Dark = localStorage.getItem(DARKMODE_KEY);
  if (v2Dark !== null) {
    darkMode = v2Dark === 'true';
  } else {
    const v1Dark = localStorage.getItem(V1_DARKMODE_KEY);
    if (v1Dark !== null) {
      darkMode = v1Dark === 'true';
    } else {
      darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  // Try loading v2 events
  try {
    const v2Data = localStorage.getItem(EVENTS_KEY);
    if (v2Data) {
      const events: SpeechEvent[] = JSON.parse(v2Data);
      if (Array.isArray(events)) {
        // Migrate segments: ensure new fields have defaults
        for (const ev of events) {
          for (const seg of ev.segments) {
            if (seg.tickEnabled === undefined) seg.tickEnabled = false;
            // Migrate existing colorAlerts: add background field if missing
            if (seg.colorAlerts) {
              for (const alert of seg.colorAlerts) {
                if ((alert as any).background === undefined) (alert as any).background = true;
              }
            }
            // Migrate old backgroundColor → colorAlerts
            if (!seg.colorAlerts) {
              const oldColor = (seg as any).backgroundColor || '#3B82F6';
              seg.colorAlerts = [
                { id: crypto.randomUUID(), timeInSeconds: 300, color: '#EAB308', background: true, flash: false, sound: false, label: '5 min' },
                { id: crypto.randomUUID(), timeInSeconds: 60,  color: '#F97316', background: true, flash: true,  sound: false, label: '1 min' },
                { id: crypto.randomUUID(), timeInSeconds: 10,  color: oldColor,  background: true, flash: true,  sound: true,  label: '10 sec' },
              ] as SpeechColorAlert[];
              delete (seg as any).backgroundColor;
            }
          }
        }
        return {
          events,
          currentScreen: 'eventList',
          activeEventId: null,
          activeSegmentId: null,
          runningEventId: null,
          runningSegmentIndex: 0,
          darkMode,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load v2 events:', e);
  }

  // Migrate from v1 if available
  try {
    const v1Data = localStorage.getItem(V1_CONFIG_KEY);
    if (v1Data) {
      const oldConfig = JSON.parse(v1Data);
      if (oldConfig.mode && typeof oldConfig.initialTimeInSeconds === 'number') {
        const migratedEvent: SpeechEvent = {
          id: crypto.randomUUID(),
          title: 'Migrated Timer',
          date: new Date().toISOString().split('T')[0],
          startTime: '00:00',
          endTime: '01:00',
          segments: [{
            id: crypto.randomUUID(),
            name: 'Timer',
            durationSeconds: oldConfig.initialTimeInSeconds,
            mode: oldConfig.mode === 'countup' ? 'countup' : 'countdown',
            colorAlerts: [
              { id: crypto.randomUUID(), timeInSeconds: 300, color: '#EAB308', background: true, flash: false, sound: false, label: '5 min' },
              { id: crypto.randomUUID(), timeInSeconds: 60,  color: '#F97316', background: true, flash: true,  sound: false, label: '1 min' },
              { id: crypto.randomUUID(), timeInSeconds: 10,  color: '#EF4444', background: true, flash: true,  sound: true,  label: '10 sec' },
            ],
            soundEnabled: oldConfig.playAlertSound ?? true,
            flashEnabled: false,
            tickEnabled: oldConfig.playTickSound ?? false,
          }],
          scheduledStartTime: null,
        };
        return {
          events: [migratedEvent],
          currentScreen: 'eventList',
          activeEventId: null,
          activeSegmentId: null,
          runningEventId: null,
          runningSegmentIndex: 0,
          darkMode,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to migrate v1 config:', e);
  }

  // Fresh install
  return {
    events: [],
    currentScreen: 'eventList',
    activeEventId: null,
    activeSegmentId: null,
    runningEventId: null,
    runningSegmentIndex: 0,
    darkMode,
  };
}

export function saveEvents(events: SpeechEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn('Failed to save events:', e);
  }
}

export function saveDarkMode(darkMode: boolean): void {
  try {
    localStorage.setItem(DARKMODE_KEY, String(darkMode));
  } catch (e) {
    console.warn('Failed to save dark mode:', e);
  }
}
