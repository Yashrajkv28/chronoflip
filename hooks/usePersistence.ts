import type { SpeechEvent, AppState, SpeechColorAlert } from '../types';

const EVENTS_KEY = 'chronoflip-v2-events';
const DARKMODE_KEY = 'chronoflip-v2-darkmode';

export function loadAppState(): AppState {
  let darkMode = false;

  const savedDark = localStorage.getItem(DARKMODE_KEY);
  if (savedDark !== null) {
    darkMode = savedDark === 'true';
  } else {
    darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Load events
  try {
    const data = localStorage.getItem(EVENTS_KEY);
    if (data) {
      const events: SpeechEvent[] = JSON.parse(data);
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
    console.warn('Failed to load events:', e);
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
