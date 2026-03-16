import React, { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { SpeechEvent, Segment, Screen, AppState } from './types';
import { createDefaultEvent, createDefaultSegment } from './types';
import { loadAppState, saveEvents } from './hooks/usePersistence';
import { removeSharedEvent } from './services/syncService';
import EventListScreen from './components/screens/EventListScreen';
import EventSettingsScreen from './components/screens/EventSettingsScreen';
import SegmentSettingsScreen from './components/screens/SegmentSettingsScreen';
import TimerRunningScreen from './components/screens/TimerRunningScreen';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  // ===== State =====
  const [showHelp, setShowHelp] = useState(false);

  // ===== Speech timer state =====
  const [appState, setAppState] = useState<AppState>(loadAppState);

  // Derived values
  const activeEvent = appState.events.find(e => e.id === appState.activeEventId) ?? null;
  const activeSegment = activeEvent?.segments.find(s => s.id === appState.activeSegmentId) ?? null;
  const runningEvent = appState.events.find(e => e.id === appState.runningEventId) ?? null;

  // ===== Persistence =====

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('mesh-bg');
    document.body.classList.add('light-mesh-bg');
  }, []);

  useEffect(() => {
    saveEvents(appState.events);
  }, [appState.events]);

  // ===== Navigation =====

  const navigateTo = useCallback((screen: Screen, opts?: { eventId?: string; segmentId?: string }) => {
    setAppState(prev => ({
      ...prev,
      currentScreen: screen,
      activeEventId: opts?.eventId ?? prev.activeEventId,
      activeSegmentId: opts?.segmentId ?? prev.activeSegmentId,
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
      events: prev.events.map(e => e.id === eventId ? { ...e, ...updates } : e),
    }));
  }, []);

  const deleteEvent = useCallback((eventId: string) => {
    setAppState(prev => {
      const deleted = prev.events.find(e => e.id === eventId);
      if (deleted?.shareId) {
        removeSharedEvent(deleted.shareId).catch(() => {});
      }
      return {
        ...prev,
        events: prev.events.filter(e => e.id !== eventId),
        activeEventId: prev.activeEventId === eventId ? null : prev.activeEventId,
      };
    });
  }, []);

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
        e.id === eventId ? { ...e, segments: [...e.segments, newSeg] } : e
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
          ? { ...e, segments: e.segments.map(s => s.id === segmentId ? { ...s, ...updates } : s) }
          : e
      ),
    }));
  }, []);

  const deleteSegment = useCallback((eventId: string, segmentId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e =>
        e.id === eventId
          ? { ...e, segments: e.segments.filter(s => s.id !== segmentId) }
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
        return { ...e, segments: arrayMove(e.segments, oldIndex, newIndex) };
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
    document.body.style.backgroundColor = '';
    document.body.style.backgroundImage = '';
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e =>
        e.id === prev.runningEventId ? { ...e, scheduledStartTime: null } : e
      ),
      runningEventId: null,
      runningSegmentIndex: 0,
      currentScreen: 'eventSettings',
    }));
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
          onScheduleStart={(time) => {
            setAppState(prev => ({
              ...prev,
              events: prev.events.map(e =>
                e.id === activeEvent.id ? { ...e, scheduledStartTime: time } : e
              ),
              activeEventId: activeEvent.id,
              runningEventId: activeEvent.id,
              runningSegmentIndex: 0,
              currentScreen: 'timerRunning',
            }));
          }}
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

      {/* Help Button */}
      {showGlobalUI && (
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
      )}

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

export default App;
