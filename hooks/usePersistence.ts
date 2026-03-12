import type { SpeechEvent, AppState } from '../types';

const EVENTS_KEY = 'chronoflip-v2-events';

export function loadAppState(): AppState {

  // Load events
  try {
    const data = localStorage.getItem(EVENTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Migrate segments: ensure new fields have defaults
        const events: SpeechEvent[] = parsed.map((event: any) => ({
          ...event,
          segments: (event.segments || []).map((seg: any) => ({
            ...seg,
            // Migrate: derive color from first colorAlert, default to blue
            color: seg.color ?? seg.colorAlerts?.[0]?.color ?? '#3B82F6',
            tickEnabled: seg.tickEnabled ?? false,
          })),
        }));
        return {
          events,
          currentScreen: 'eventList',
          activeEventId: null,
          activeSegmentId: null,
          runningEventId: null,
          runningSegmentIndex: 0,
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
  };
}

export function saveEvents(events: SpeechEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn('Failed to save events:', e);
  }
}
