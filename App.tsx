import React, { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { SpeechEvent, Segment, Screen, AppState } from './types';
import { createDefaultEvent, createDefaultSegment } from './types';
import { loadAppState, saveEvents, saveDarkMode } from './hooks/usePersistence';
import { loadConfig, saveConfig, type TimerConfig } from './config';
import TimerSettings from './components/TimerSettings';
import EventListScreen from './components/screens/EventListScreen';
import EventSettingsScreen from './components/screens/EventSettingsScreen';
import SegmentSettingsScreen from './components/screens/SegmentSettingsScreen';
import TimerRunningScreen from './components/screens/TimerRunningScreen';
import HelpModal from './components/HelpModal';

const App: React.FC = () => {
  // ===== State =====
  const [showHelp, setShowHelp] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('chronoflip-darkmode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // ===== Orb config =====
  const [orbConfig, setOrbConfig] = useState(() => {
    const cfg = loadConfig();
    return { colors: cfg.orbColors, opacities: cfg.orbOpacities };
  });
  const [showSettings, setShowSettings] = useState(false);

  // ===== Speech timer state =====
  const [appState, setAppState] = useState<AppState>(loadAppState);

  // Derived values
  const activeEvent = appState.events.find(e => e.id === appState.activeEventId) ?? null;
  const activeSegment = activeEvent?.segments.find(s => s.id === appState.activeSegmentId) ?? null;
  const runningEvent = appState.events.find(e => e.id === appState.runningEventId) ?? null;
  const isTimerRunning = appState.currentScreen === 'timerRunning';

  // ===== Persistence =====

  useEffect(() => {
    localStorage.setItem('chronoflip-darkmode', String(darkMode));
    saveDarkMode(darkMode);
    const body = document.body;
    if (darkMode) {
      document.documentElement.classList.add('dark');
      body.classList.remove('light-mesh-bg');
      body.classList.add('mesh-bg');
    } else {
      document.documentElement.classList.remove('dark');
      body.classList.remove('mesh-bg');
      body.classList.add('light-mesh-bg');
    }
  }, [darkMode]);

  useEffect(() => {
    saveEvents(appState.events);
  }, [appState.events]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isTimerRunning) return;
      if (e.code === 'KeyD' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDarkMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTimerRunning]);

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
    setAppState(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== eventId),
      activeEventId: prev.activeEventId === eventId ? null : prev.activeEventId,
    }));
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

  // ===== Appearance settings (orb customization) =====

  const handleSettingsSave = useCallback((newConfig: TimerConfig) => {
    saveConfig(newConfig);
    setOrbConfig({ colors: newConfig.orbColors, opacities: newConfig.orbOpacities });
    setShowSettings(false);
  }, []);

  // ===== Render =====

  const showGlobalUI = !isTimerRunning;

  return (
    <div className="relative text-gray-900 dark:text-white h-[100dvh] overflow-hidden">

      {/* Background Orbs (dark mode only) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="hidden dark:block absolute top-10 left-10 w-96 h-96 rounded-full blur-[120px]" style={{ backgroundColor: orbConfig.colors[0], opacity: orbConfig.opacities[0] / 100 }} />
        <div className="hidden dark:block absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full blur-[150px]" style={{ backgroundColor: orbConfig.colors[1], opacity: orbConfig.opacities[1] / 100 }} />
        <div className="hidden dark:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[180px]" style={{ backgroundColor: orbConfig.colors[2], opacity: orbConfig.opacities[2] / 100 }} />
      </div>

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

      {/* Dark Mode Toggle */}
      {showGlobalUI && (
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          title="Toggle Dark Mode (D)"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="fixed top-[max(1.5rem,env(safe-area-inset-top))] right-4 sm:right-6 z-50 p-3 rounded-full
                     bg-white/20 dark:bg-black/20 backdrop-blur-md
                     border border-white/20 dark:border-white/10
                     shadow-lg hover:scale-110 transition-all duration-200"
        >
          {darkMode ? (
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      )}

      {/* Help Button */}
      {showGlobalUI && (
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          title="Help & Keyboard Shortcuts"
          aria-label="Open help and keyboard shortcuts"
          className="fixed bottom-6 left-6 z-50 p-3 rounded-full
                     bg-white/20 dark:bg-black/20 backdrop-blur-md
                     border border-white/20 dark:border-white/10
                     shadow-lg hover:scale-110 transition-all duration-200"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Settings Button */}
      {showGlobalUI && (
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="Appearance Settings"
          aria-label="Open appearance settings"
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full
                     bg-white/20 dark:bg-black/20 backdrop-blur-md
                     border border-white/20 dark:border-white/10
                     shadow-lg hover:scale-110 transition-all duration-200"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      )}

      {/* Appearance Settings */}
      {showSettings && (
        <TimerSettings
          config={loadConfig()}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
          appMode="clock"
        />
      )}

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

export default App;
