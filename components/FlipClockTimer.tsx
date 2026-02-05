import React, { useState, useEffect, useCallback, useRef } from 'react';
import FlipClockDisplay from './FlipClockDisplay';
import TimerSettings from './TimerSettings';
import { audioService } from '../services/audioService';

// Types
export type TimerMode = 'countdown' | 'countup' | 'hybrid';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface ColorAlert {
  id: string;
  timeInSeconds: number;
  colorClass: string;
  flash: boolean;
  sound: boolean;
  label: string;
}

export interface TimerConfig {
  mode: TimerMode;
  initialTimeInSeconds: number;
  colorAlerts: ColorAlert[];
  showHours: boolean;
  showDays: boolean;
  playTickSound: boolean;
  playAlertSound: boolean;
}

const DEFAULT_ALERTS: ColorAlert[] = [
  { id: '1', timeInSeconds: 300, colorClass: 'text-yellow-500', flash: false, sound: true, label: '5 minutes' },
  { id: '2', timeInSeconds: 60, colorClass: 'text-orange-500', flash: true, sound: true, label: '1 minute' },
  { id: '3', timeInSeconds: 10, colorClass: 'text-red-500', flash: true, sound: true, label: '10 seconds' },
];

const DEFAULT_CONFIG: TimerConfig = {
  mode: 'countdown',
  initialTimeInSeconds: 300, // 5 minutes default
  colorAlerts: DEFAULT_ALERTS,
  showHours: true,
  showDays: false,
  playTickSound: false,
  playAlertSound: true,
};

const STORAGE_KEY = 'chronoflip-config';

// Load config from localStorage with validation
const loadConfig = (): TimerConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate essential properties exist
      if (parsed.mode && typeof parsed.initialTimeInSeconds === 'number') {
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Failed to load saved config:', e);
  }
  return DEFAULT_CONFIG;
};

// Save config to localStorage
const saveConfig = (config: TimerConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save config:', e);
  }
};

const FlipClockTimer: React.FC = () => {
  // State - load from localStorage on init
  const [config, setConfig] = useState<TimerConfig>(loadConfig);
  const [timeInSeconds, setTimeInSeconds] = useState(() => loadConfig().initialTimeInSeconds);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [currentColorClass, setCurrentColorClass] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hybridPhase, setHybridPhase] = useState<'countdown' | 'countup'>('countdown');
  const [elapsedAfterZero, setElapsedAfterZero] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [isBlackout, setIsBlackout] = useState(false);

  // Refs
  const intervalRef = useRef<number | null>(null);
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  const resetTimerRef = useRef<number | null>(null);
  const resetIntervalRef = useRef<number | null>(null);

  // Timestamp refs for accurate timing (immune to browser throttling)
  const startTimeRef = useRef<number | null>(null);      // When timer started (ms)
  const pausedAtRef = useRef<number | null>(null);       // When paused (ms)
  const totalPausedMsRef = useRef<number>(0);            // Total time spent paused (ms)
  const initialTimeRef = useRef<number>(config.initialTimeInSeconds); // Initial time for current run

  // Wake Lock API - prevents screen sleep during timer
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Re-acquire wake lock when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && status === 'running') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status]);

  // Exit blackout mode on any key press
  useEffect(() => {
    if (!isBlackout) return;

    const exitBlackout = () => setIsBlackout(false);
    window.addEventListener('keydown', exitBlackout);
    return () => window.removeEventListener('keydown', exitBlackout);
  }, [isBlackout]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Persist config to localStorage whenever it changes
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Calculate display time
  // When idle, show config.initialTimeInSeconds directly (fixes preset button sync issue)
  const displayTime = status === 'idle'
    ? config.initialTimeInSeconds
    : (config.mode === 'hybrid' && hybridPhase === 'countup'
        ? elapsedAfterZero
        : timeInSeconds);

  const days = Math.floor(displayTime / 86400);
  const hours = Math.floor((displayTime % 86400) / 3600);
  const minutes = Math.floor((displayTime % 3600) / 60);
  const seconds = displayTime % 60;

  // Update browser tab title with timer
  useEffect(() => {
    const originalTitle = 'ChronoFlip Premium';

    if (status === 'running' || status === 'paused') {
      // Format time for tab title
      const pad = (n: number) => n.toString().padStart(2, '0');
      let timeStr = `${pad(minutes)}:${pad(seconds)}`;
      if (config.showHours || hours > 0) {
        timeStr = `${pad(hours)}:${timeStr}`;
      }
      if (config.showDays || days > 0) {
        timeStr = `${days}d ${timeStr}`;
      }

      const statusIcon = status === 'paused' ? '⏸ ' : '⏱ ';
      document.title = `${statusIcon}${timeStr} - ChronoFlip`;
    } else {
      document.title = originalTitle;
    }

    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = originalTitle;
    };
  }, [status, days, hours, minutes, seconds, config.showHours, config.showDays]);

  // Check color alerts
  const checkColorAlerts = useCallback((currentTime: number) => {
    const sortedAlerts = [...config.colorAlerts].sort((a, b) => b.timeInSeconds - a.timeInSeconds);

    for (const alert of sortedAlerts) {
      if (currentTime <= alert.timeInSeconds) {
        setCurrentColorClass(alert.colorClass);

        // Trigger alert once
        if (!triggeredAlertsRef.current.has(alert.id) && currentTime === alert.timeInSeconds) {
          triggeredAlertsRef.current.add(alert.id);

          if (alert.flash) {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 500);
          }

          if (alert.sound && config.playAlertSound) {
            // Use warning for critical times (<=10s), alert for others
            audioService.play(currentTime <= 10 ? 'warning' : 'alert');
          }
        }
        break;
      }
    }
  }, [config.colorAlerts, config.playAlertSound]);

  // Timer tick - TIMESTAMP-BASED for accuracy (immune to browser throttling)
  useEffect(() => {
    if (status !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initialize start time if not set
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    // Use shorter interval (250ms) since we calculate from timestamps anyway
    // This makes the display more responsive when returning to the tab
    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTimeRef.current! - totalPausedMsRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      if (config.mode === 'countdown' || (config.mode === 'hybrid' && hybridPhase === 'countdown')) {
        const remaining = Math.max(0, initialTimeRef.current - elapsedSeconds);

        // Check alerts based on remaining time
        checkColorAlerts(remaining);

        if (remaining <= 0) {
          if (config.mode === 'hybrid') {
            // Switch to countup phase
            setHybridPhase('countup');
            setCurrentColorClass('text-blue-500');
            triggeredAlertsRef.current.clear();
            // Reset timing for countup phase
            startTimeRef.current = Date.now();
            totalPausedMsRef.current = 0;
            if (config.playAlertSound) {
              audioService.play('finish');
            }
            setTimeInSeconds(0);
          } else {
            // Countdown complete
            setStatus('completed');
            releaseWakeLock(); // Allow screen to sleep
            if (config.playAlertSound) {
              audioService.play('finish');
            }
            setTimeInSeconds(0);
          }
        } else {
          setTimeInSeconds(remaining);
        }
      } else if (config.mode === 'countup' || (config.mode === 'hybrid' && hybridPhase === 'countup')) {
        if (config.mode === 'hybrid') {
          setElapsedAfterZero(elapsedSeconds);
        } else {
          setTimeInSeconds(elapsedSeconds);
        }
      }
    }, 100); // 100ms for responsive updates (10 updates/sec)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, config.mode, config.playAlertSound, hybridPhase, checkColorAlerts]);

  // Control functions
  const handleStart = () => {
    if (status === 'idle' || status === 'completed') {
      // Use config.initialTimeInSeconds as the starting point
      const startTime = config.initialTimeInSeconds;
      // Reset all timing refs for fresh start
      startTimeRef.current = null; // Will be set in useEffect
      pausedAtRef.current = null;
      totalPausedMsRef.current = 0;
      initialTimeRef.current = startTime;
      triggeredAlertsRef.current.clear();
      setHybridPhase('countdown');
      setElapsedAfterZero(0);
      setTimeInSeconds(startTime); // Sync timeInSeconds for running state
      if (config.mode !== 'countup') {
        checkColorAlerts(startTime);
      }
    }
    audioService.play('start');
    setStatus('running');
    requestWakeLock(); // Prevent screen sleep
  };

  const handlePause = () => {
    // Record when we paused
    pausedAtRef.current = Date.now();
    audioService.play('pause');
    setStatus('paused');
    releaseWakeLock(); // Allow screen to sleep
  };

  const handleResume = () => {
    // Add paused duration to total
    if (pausedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    audioService.play('start');
    setStatus('running');
  };

  // handleReset now accepts optional parameter to fix stale closure bug
  const handleReset = (newInitialTime?: number) => {
    const initialTime = newInitialTime ?? config.initialTimeInSeconds;
    setStatus('idle');
    setTimeInSeconds(initialTime);
    setCurrentColorClass('');
    setHybridPhase('countdown');
    setElapsedAfterZero(0);
    triggeredAlertsRef.current.clear();
    // Clear all timestamp refs
    startTimeRef.current = null;
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    initialTimeRef.current = initialTime;
    releaseWakeLock(); // Allow screen to sleep
  };

  // Reset confirmation - long press handlers
  const RESET_HOLD_DURATION = 1500; // 1.5 seconds
  const PROGRESS_UPDATE_INTERVAL = 50; // Update every 50ms

  const clearResetTimers = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    resetTimerRef.current = null;
    resetIntervalRef.current = null;
  };

  const handleResetMouseDown = () => {
    // Immediate reset when idle - no confirmation needed
    if (status === 'idle') {
      handleReset();
      return;
    }

    // Start progress animation
    let progress = 0;
    resetIntervalRef.current = window.setInterval(() => {
      progress += (PROGRESS_UPDATE_INTERVAL / RESET_HOLD_DURATION) * 100;
      setResetProgress(Math.min(progress, 100));
    }, PROGRESS_UPDATE_INTERVAL);

    // Trigger reset after hold duration
    resetTimerRef.current = window.setTimeout(() => {
      handleReset();
      clearResetTimers();
      setResetProgress(0);
      // Haptic feedback on mobile
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, RESET_HOLD_DURATION);
  };

  const handleResetMouseUp = () => {
    clearResetTimers();
    setResetProgress(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (status === 'idle' || status === 'completed') {
            handleStart();
          } else if (status === 'running') {
            handlePause();
          } else if (status === 'paused') {
            handleResume();
          }
          break;
        case 'KeyR':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleReset();
          }
          break;
        case 'KeyS':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setShowSettings(prev => !prev);
          }
          break;
        case 'Escape':
          if (isBlackout) {
            setIsBlackout(false);
          } else if (showSettings) {
            setShowSettings(false);
          } else if (isFullscreen) {
            document.exitFullscreen();
          }
          break;
        case 'KeyF':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'KeyB':
          if (!e.metaKey && !e.ctrlKey && status === 'running') {
            e.preventDefault();
            setIsBlackout(prev => !prev);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, showSettings, isFullscreen, isBlackout, toggleFullscreen]);

  const handleConfigSave = (newConfig: TimerConfig) => {
    const newTime = newConfig.initialTimeInSeconds;
    // Auto-enable showHours when time >= 60 minutes
    const finalConfig = {
      ...newConfig,
      showHours: newConfig.showHours || newTime >= 3600
    };
    // Update config - display derives from config.initialTimeInSeconds when idle
    setConfig(finalConfig);
    setStatus('idle');
    setCurrentColorClass('');
    setHybridPhase('countdown');
    setElapsedAfterZero(0);
    setShowSettings(false);
    // Update refs
    triggeredAlertsRef.current.clear();
    startTimeRef.current = null;
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    initialTimeRef.current = newTime;
  };

  const presets = [
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '15m', seconds: 900 },
    { label: '20m', seconds: 1200 },
    { label: '30m', seconds: 1800 },
    { label: '45m', seconds: 2700 },
    { label: '60m', seconds: 3600 },
  ];

  const handlePresetClick = (seconds: number) => {
    // Auto-enable showHours when time >= 60 minutes
    const shouldShowHours = seconds >= 3600;
    // Update config - display derives from config.initialTimeInSeconds when idle
    setConfig(prev => ({
      ...prev,
      initialTimeInSeconds: seconds,
      showHours: shouldShowHours || prev.showHours // Keep enabled if already on
    }));
    // Reset other state
    setCurrentColorClass('');
    setHybridPhase('countdown');
    setElapsedAfterZero(0);
    // Update refs
    triggeredAlertsRef.current.clear();
    startTimeRef.current = null;
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    initialTimeRef.current = seconds;
  };

  // Status badge with phase-specific labels
  const getStatusBadge = () => {
    const baseClasses = "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border";

    // Handle running state with mode-specific labels
    if (status === 'running') {
      if (config.mode === 'hybrid') {
        // Hybrid mode: show Presentation or Q&A based on phase
        if (hybridPhase === 'countdown') {
          return <span className={`${baseClasses} bg-emerald-500/10 border-emerald-500/20 text-emerald-500`}>Presentation</span>;
        } else {
          return <span className={`${baseClasses} bg-blue-500/10 border-blue-500/20 text-blue-500`}>Q&A</span>;
        }
      } else if (config.mode === 'countdown') {
        return <span className={`${baseClasses} bg-emerald-500/10 border-emerald-500/20 text-emerald-500`}>Countdown</span>;
      } else {
        return <span className={`${baseClasses} bg-emerald-500/10 border-emerald-500/20 text-emerald-500`}>Count-up</span>;
      }
    }

    switch (status) {
      case 'paused':
        return <span className={`${baseClasses} bg-amber-500/10 border-amber-500/20 text-amber-500`}>Paused</span>;
      case 'completed':
        return <span className={`${baseClasses} bg-red-500/10 border-red-500/20 text-red-500`}>Complete</span>;
      default:
        return <span className={`${baseClasses} bg-gray-500/10 border-gray-500/20 text-gray-500 dark:text-gray-400`}>Ready</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      
      {/* Decorative background elements - dark mode only */}
      <div className="hidden dark:block absolute top-10 left-10 w-96 h-96 bg-purple-500/30 rounded-full blur-[120px]"></div>
      <div className="hidden dark:block absolute bottom-10 right-10 w-[500px] h-[500px] bg-blue-500/25 rounded-full blur-[150px]"></div>
      <div className="hidden dark:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[180px]"></div>

      {/* Main Glass Container */}
      <div className="relative z-10 flex flex-col items-center">

        {/* Header Badges */}
        <div className="flex gap-4 mb-8 sm:mb-12 animate-[fadeIn_0.5s_ease-out]">
          {/* Removed getModeBadge() */}
          {getStatusBadge()}
        </div>

        {/* CLOCK DISPLAY CONTAINER - Glassmorphism */}
        <div className={`
          relative
          p-8 sm:p-12 md:p-16
          rounded-[2.5rem]
          bg-white/30 dark:bg-white/5
          backdrop-blur-2xl backdrop-saturate-150
          border border-white/40 dark:border-white/10
          shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
          dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
          transition-all duration-500
          ${isFlashing ? 'ring-2 ring-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)]' : ''}
        `}>
          <FlipClockDisplay
            days={days}
            hours={hours}
            minutes={minutes}
            seconds={seconds}
            showHours={config.showHours}
            showDays={config.showDays}
            colorClass={currentColorClass}
            isRunning={status === 'running'}
          />

          {/* Inline Preset Quick Actions (Only when Idle) */}
          {status === 'idle' && config.mode !== 'countup' && (
            <div className="flex flex-wrap justify-center gap-2 mt-10 opacity-70 hover:opacity-100 transition-opacity">
              {presets.map(preset => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => handlePresetClick(preset.seconds)}
                  className={`
                    px-3 py-1 rounded-lg text-xs font-semibold tracking-wider
                    transition-all duration-200 border
                    ${config.initialTimeInSeconds === preset.seconds
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-600 dark:text-blue-400'
                      : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100/10 hover:border-gray-200/20'}
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="mt-12 flex flex-wrap gap-4 sm:gap-6 justify-center items-center w-full">
          {status === 'idle' && (
            <button
              type="button"
              onClick={handleStart}
              className="group relative px-10 py-5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <span className="tracking-widest">START</span>
              </div>
            </button>
          )}

          {status === 'running' && (
            <button
              type="button"
              onClick={handlePause}
              className="group relative px-10 py-5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 hover:border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <span className="tracking-widest">PAUSE</span>
              </div>
            </button>
          )}

          {status === 'paused' && (
            <button
              type="button"
              onClick={handleResume}
              className="group relative px-10 py-5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <span className="tracking-widest">RESUME</span>
              </div>
            </button>
          )}

          {(status !== 'idle') && (
            <button
              type="button"
              onMouseDown={handleResetMouseDown}
              onMouseUp={handleResetMouseUp}
              onMouseLeave={handleResetMouseUp}
              onTouchStart={handleResetMouseDown}
              onTouchEnd={handleResetMouseUp}
              title="Hold to Reset (1.5s)"
              aria-label="Hold to Reset Timer"
              className="relative px-6 py-5 rounded-2xl bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white font-bold border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md overflow-hidden"
            >
              {/* Progress ring overlay */}
              {resetProgress > 0 && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background: `conic-gradient(rgba(239,68,68,0.4) ${resetProgress}%, transparent ${resetProgress}%)`
                  }}
                />
              )}
              <svg className="w-6 h-6 stroke-current relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            title="Settings (S)"
            aria-label="Open Settings"
            className="px-6 py-5 rounded-2xl bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white font-bold border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
          >
            <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            aria-label={isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
            className="px-6 py-5 rounded-2xl bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white font-bold border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
          >
            {isFullscreen ? (
              <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
            ) : (
              <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
            )}
          </button>

          {/* Blackout button - only when running */}
          {status === 'running' && (
            <button
              type="button"
              onClick={() => setIsBlackout(true)}
              title="Blackout Mode (B)"
              aria-label="Enter blackout mode - tap to restore"
              className="px-6 py-5 rounded-2xl bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white font-bold border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
            >
              <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Blackout Overlay */}
      {isBlackout && (
        <div
          className="fixed inset-0 z-[100] bg-black cursor-pointer flex items-center justify-center"
          onClick={() => setIsBlackout(false)}
        >
          <p className="text-white/20 text-sm animate-pulse select-none">
            Tap anywhere to restore
          </p>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <TimerSettings
          config={config}
          onSave={handleConfigSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default FlipClockTimer;