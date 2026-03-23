import React, { useState, useEffect, useCallback, useRef } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { SpeechEvent, Segment, Screen, AppState } from './types';
import { createDefaultEvent, createDefaultSegment } from './types';
import { loadAppState, saveEvents, syncEvents, saveEventToCloud, deleteEventFromCloud, resetPersistenceClient, recordDeletedEvent, persistPendingSaves, loadAndClearPendingSaves } from './hooks/usePersistence';
import { removeSharedEvent } from './services/syncService';
import { useAuthContext } from './hooks/AuthContext';
import EventListScreen from './components/screens/EventListScreen';
import EventSettingsScreen from './components/screens/EventSettingsScreen';
import SegmentSettingsScreen from './components/screens/SegmentSettingsScreen';
import TimerRunningScreen from './components/screens/TimerRunningScreen';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  // ===== Auth (single instance via context — no duplicate Hub listeners) =====
  const { user, signOut: handleLogout } = useAuthContext();

  // ===== State =====
  const [showHelp, setShowHelp] = useState(false);

  // ===== Speech timer state =====
  const [appState, setAppState] = useState<AppState>(loadAppState);
  const cloudSaveTimeoutRef = useRef<number | null>(null);
  const eventsRef = useRef<SpeechEvent[]>(appState.events);
  const userRef = useRef(user);
  const hasSyncedRef = useRef(false);
  // Tracks events that need cloud saving but haven't been saved yet
  const pendingSaveRef = useRef<SpeechEvent[]>([]);

  // Keep refs always current (sync assignment during render)
  eventsRef.current = appState.events;
  userRef.current = user;

  // Derived values
  const activeEvent = appState.events.find(e => e.id === appState.activeEventId) ?? null;
  const activeSegment = activeEvent?.segments.find(s => s.id === appState.activeSegmentId) ?? null;
  const runningEvent = appState.events.find(e => e.id === appState.runningEventId) ?? null;

  // ===== Persistence =====

  // Theme setup
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('mesh-bg');
    document.body.classList.add('light-mesh-bg');
    return () => {
      document.body.classList.remove('light-mesh-bg');
    };
  }, []);

  // Clean up body styles when leaving timer screen
  useEffect(() => {
    if (appState.currentScreen !== 'timerRunning') {
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
    }
  }, [appState.currentScreen]);

  // Cloud sync on login (once per user session)
  useEffect(() => {
    if (!user) {
      hasSyncedRef.current = false;
      pendingSaveRef.current = [];
      resetPersistenceClient();
      return;
    }
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    const localSnapshot = eventsRef.current;
    syncEvents(user.userId, localSnapshot).then(synced => {
      setAppState(prev => {
        // Merge: use synced results but preserve local edits made during sync
        const syncedMap = new Map(synced.map(e => [e.id, e]));
        const merged = synced.map(e => {
          const prevVersion = prev.events.find(p => p.id === e.id);
          const snapshotVersion = localSnapshot.find(s => s.id === e.id);
          // If local version changed during sync (different reference), keep it
          if (prevVersion && snapshotVersion && prevVersion !== snapshotVersion) {
            return prevVersion;
          }
          return e;
        });
        // Also include any new events created locally during sync
        for (const prevEvent of prev.events) {
          if (!syncedMap.has(prevEvent.id)) {
            merged.push(prevEvent);
          }
        }
        // Reset prev ref so persistence effect doesn't re-upload cloud-won events
        prevEventsRef.current = merged;
        return { ...prev, events: merged };
      });
    });
    // user?.userId is the only meaningful dep — eventsRef is read from ref
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to localStorage + debounced cloud save (only changed events)
  // Uses rolling debounce: each events change cancels and restarts the 2s timer
  const prevEventsRef = useRef<SpeechEvent[]>(appState.events);
  useEffect(() => {
    saveEvents(appState.events);

    if (user) {
      // Find events that actually changed (reference equality with immutable updates)
      const changed = appState.events.filter(event => {
        const prev = prevEventsRef.current.find(e => e.id === event.id);
        return !prev || prev !== event;
      });

      if (changed.length > 0) {
        // Merge with existing pending saves (deduplicate by ID)
        const existingPending = pendingSaveRef.current.filter(
          e => !changed.find(c => c.id === e.id)
        );
        pendingSaveRef.current = [...existingPending, ...changed];
        if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
        cloudSaveTimeoutRef.current = window.setTimeout(async () => {
          const currentUser = userRef.current;
          if (!currentUser) return;
          const toSave = [...pendingSaveRef.current];
          const failed: SpeechEvent[] = [];
          for (const event of toSave) {
            const ok = await saveEventToCloud(currentUser.userId, event);
            if (!ok) failed.push(event);
          }
          // Merge failed events back, preserving any newer entries added during async save
          const currentPending = pendingSaveRef.current;
          const savedIds = new Set(toSave.map(e => e.id));
          const newlyAdded = currentPending.filter(e => !savedIds.has(e.id));
          pendingSaveRef.current = [
            ...failed.map(f => currentPending.find(c => c.id === f.id) ?? f),
            ...newlyAdded,
          ];
        }, 2000);
      }
    }

    prevEventsRef.current = appState.events;

    // Rolling debounce cleanup: cancel pending timer on re-run
    return () => {
      if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
    };
  }, [appState.events, user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Replay pending saves persisted during previous page close
  useEffect(() => {
    if (!user) return;
    const pending = loadAndClearPendingSaves();
    if (pending.length > 0) {
      Promise.all(pending.map(event => saveEventToCloud(user.userId, event))).catch(() => {});
    }
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending cloud saves on unmount and page close
  useEffect(() => {
    const flushPending = () => {
      if (pendingSaveRef.current.length > 0 && userRef.current) {
        if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
        // Persist to localStorage (survives browser kill — replayed on next load)
        persistPendingSaves(pendingSaveRef.current);
        // Also attempt async save (works for SPA unmount, not hard page close)
        for (const event of pendingSaveRef.current) {
          saveEventToCloud(userRef.current.userId, event);
        }
        pendingSaveRef.current = [];
      }
    };
    window.addEventListener('beforeunload', flushPending);
    return () => {
      window.removeEventListener('beforeunload', flushPending);
      flushPending();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: redirect to eventList if active/running event was deleted (e.g., by sync)
  useEffect(() => {
    if (appState.currentScreen === 'timerRunning' && appState.runningEventId && !runningEvent) {
      setAppState(prev => ({ ...prev, currentScreen: 'eventList', runningEventId: null, runningSegmentIndex: 0 }));
    }
    if (appState.currentScreen === 'eventSettings' && appState.activeEventId && !activeEvent) {
      setAppState(prev => ({ ...prev, currentScreen: 'eventList', activeEventId: null }));
    }
    if (appState.currentScreen === 'segmentSettings' && (!activeEvent || !activeSegment)) {
      if (!activeEvent) {
        setAppState(prev => ({ ...prev, currentScreen: 'eventList', activeEventId: null, activeSegmentId: null }));
      } else {
        setAppState(prev => ({ ...prev, currentScreen: 'eventSettings', activeSegmentId: null }));
      }
    }
  }, [appState.currentScreen, appState.activeEventId, appState.runningEventId, activeEvent, activeSegment, runningEvent]);

  // ===== Navigation =====

  const navigateTo = useCallback((screen: Screen, opts?: { eventId?: string; segmentId?: string }) => {
    setAppState(prev => ({
      ...prev,
      currentScreen: screen,
      activeEventId: opts?.eventId ?? (screen === 'eventList' ? null : prev.activeEventId),
      activeSegmentId: opts?.segmentId ?? (screen === 'eventList' || screen === 'eventSettings' ? null : prev.activeSegmentId),
    }));
  }, []);

  // ===== Event CRUD =====

  const addEvent = useCallback(() => {
    const newEvent = createDefaultEvent();
    setAppState(prev => ({
      ...prev,
      events: [...prev.events, newEvent],
      currentScreen: 'eventSettings',
      activeEventId: newEvent.id,
    }));
  }, []);

  const updateEvent = useCallback((eventId: string, updates: Partial<SpeechEvent>) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === eventId ? { ...e, ...updates, updatedAt: Date.now() } : e),
    }));
  }, []);

  const deleteEvent = useCallback((eventId: string) => {
    // Read from ref for guaranteed-current state (no stale closure)
    const event = eventsRef.current.find(e => e.id === eventId);
    if (user && event?.shareId) {
      removeSharedEvent(event.shareId).catch(err => console.warn('Failed to remove shared event:', err));
    }
    recordDeletedEvent(eventId);
    if (user) {
      deleteEventFromCloud(user.userId, eventId).catch(() => {});
    }
    setAppState(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== eventId),
      activeEventId: prev.activeEventId === eventId ? null : prev.activeEventId,
    }));
  }, [user]);

  const reorderEvents = useCallback((activeId: string, overId: string) => {
    setAppState(prev => {
      const oldIndex = prev.events.findIndex(e => e.id === activeId);
      const newIndex = prev.events.findIndex(e => e.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return { ...prev, events: arrayMove(prev.events, oldIndex, newIndex) };
    });
  }, []);

  // ===== Segment CRUD =====

  const addSegment = useCallback((eventId: string) => {
    const newSeg = createDefaultSegment();
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e =>
        e.id === eventId ? { ...e, segments: [...e.segments, newSeg], updatedAt: Date.now() } : e
      ),
      currentScreen: 'segmentSettings',
      activeSegmentId: newSeg.id,
    }));
  }, []);

  const updateSegment = useCallback((eventId: string, segmentId: string, updates: Partial<Segment>) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e =>
        e.id === eventId
          ? { ...e, segments: e.segments.map(s => s.id === segmentId ? { ...s, ...updates } : s), updatedAt: Date.now() }
          : e
      ),
    }));
  }, []);

  const deleteSegment = useCallback((eventId: string, segmentId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e =>
        e.id === eventId
          ? { ...e, segments: e.segments.filter(s => s.id !== segmentId), updatedAt: Date.now() }
          : e
      ),
    }));
  }, []);

  const reorderSegments = useCallback((eventId: string, activeId: string, overId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => {
        if (e.id !== eventId) return e;
        const oldIndex = e.segments.findIndex(s => s.id === activeId);
        const newIndex = e.segments.findIndex(s => s.id === overId);
        if (oldIndex === -1 || newIndex === -1) return e;
        return { ...e, segments: arrayMove(e.segments, oldIndex, newIndex), updatedAt: Date.now() };
      }),
    }));
  }, []);

  // ===== Timer control =====

  const startEvent = useCallback((eventId: string, startSegmentIndex = 0) => {
    setAppState(prev => ({
      ...prev,
      activeEventId: eventId,
      runningEventId: eventId,
      runningSegmentIndex: startSegmentIndex,
      currentScreen: 'timerRunning',
    }));
  }, []);

  const exitTimer = useCallback(() => {
    setAppState(prev => {
      if (!prev.runningEventId) return prev;
      return {
        ...prev,
        events: prev.events.map(e =>
          e.id === prev.runningEventId ? { ...e, scheduledStartTime: null, updatedAt: Date.now() } : e
        ),
        runningEventId: null,
        runningSegmentIndex: 0,
        currentScreen: 'eventSettings',
      };
    });
  }, []);

  // Stable callback for schedule start (reads from prev state, no stale closure)
  const handleScheduleStart = useCallback((time: number) => {
    setAppState(prev => {
      const eventId = prev.activeEventId;
      if (!eventId) return prev;
      return {
        ...prev,
        events: prev.events.map(e =>
          e.id === eventId ? { ...e, scheduledStartTime: time, updatedAt: Date.now() } : e
        ),
        runningEventId: eventId,
        runningSegmentIndex: 0,
        currentScreen: 'timerRunning' as Screen,
      };
    });
  }, []);

  // ===== Render =====

  const showGlobalUI = appState.currentScreen !== 'timerRunning';

  return (
    <div className="relative text-gray-900 h-[100dvh] overflow-hidden">
      {appState.currentScreen === 'eventList' && (
        <EventListScreen
          events={appState.events}
          onAddEvent={addEvent}
          onSelectEvent={(id) => navigateTo('eventSettings', { eventId: id })}
          onStartEvent={(id) => startEvent(id)}
          onDeleteEvent={deleteEvent}
          onReorderEvents={reorderEvents}
          onShowHelp={() => setShowHelp(true)}
        />
      )}

      {appState.currentScreen === 'eventSettings' && activeEvent && (
        <EventSettingsScreen
          event={activeEvent}
          onBack={() => navigateTo('eventList')}
          onUpdateEvent={(updates) => updateEvent(activeEvent.id, updates)}
          onAddSegment={() => addSegment(activeEvent.id)}
          onEditSegment={(segId) => navigateTo('segmentSettings', { segmentId: segId })}
          onDeleteSegment={(segId) => deleteSegment(activeEvent.id, segId)}
          onReorderSegments={(activeId, overId) => reorderSegments(activeEvent.id, activeId, overId)}
          onStartEvent={(idx) => startEvent(activeEvent.id, idx)}
          onScheduleStart={handleScheduleStart}
        />
      )}

      {appState.currentScreen === 'segmentSettings' && activeEvent && activeSegment && (
        <SegmentSettingsScreen
          segment={activeSegment}
          onSave={(updates) => {
            updateSegment(activeEvent.id, activeSegment.id, updates);
            navigateTo('eventSettings');
          }}
          onClose={() => navigateTo('eventSettings')}
        />
      )}

      {appState.currentScreen === 'timerRunning' && runningEvent && (
        <TimerRunningScreen
          event={runningEvent}
          startSegmentIndex={appState.runningSegmentIndex}
          onExit={exitTimer}
        />
      )}

      {/* ====== Global UI ====== */}

      {/* Help + Logout Buttons */}
      {showGlobalUI && (
        <>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            title="Help & Keyboard Shortcuts"
            aria-label="Open help and keyboard shortcuts"
            className="fixed bottom-6 left-6 z-50 p-3 rounded-full
                       bg-white/20 backdrop-blur-md
                       border border-white/20
                       shadow-lg hover:scale-110 transition-all duration-200"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
            </svg>
          </button>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="fixed bottom-6 right-6 z-50 p-3 rounded-full
                         bg-white/20 backdrop-blur-md
                         border border-white/20
                         shadow-lg hover:scale-110 transition-all duration-200"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </>
      )}

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

export default App;
