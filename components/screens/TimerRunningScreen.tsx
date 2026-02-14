import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import type { SpeechEvent, SpeechColorAlert } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { useWakeLock } from '../../hooks/useWakeLock';
import { audioService } from '../../services/audioService';
import FlipClockDisplay from '../FlipClockDisplay';
import SegmentTransition from '../ui/SegmentTransition';

interface TimerRunningScreenProps {
  event: SpeechEvent;
  startSegmentIndex: number;
  onExit: () => void;
}

const TimerRunningScreen: React.FC<TimerRunningScreenProps> = ({
  event,
  startSegmentIndex,
  onExit,
}) => {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(startSegmentIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashColor, setFlashColor] = useState('');
  const [activeAlertColor, setActiveAlertColor] = useState('');
  const triggeredAlertIdsRef = useRef<Set<string>>(new Set());
  const [isWaitingSchedule, setIsWaitingSchedule] = useState(() => {
    return event.scheduledStartTime != null && event.scheduledStartTime > Date.now();
  });
  const [scheduleCountdown, setScheduleCountdown] = useState('');
  const [screenOn, setScreenOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStandalone] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
  const [canFullscreen] = useState(() =>
    !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled)
  );

  // Long-press reset
  const [resetProgress, setResetProgress] = useState(0);
  const resetTimerRef = useRef<number | null>(null);
  const resetIntervalRef = useRef<number | null>(null);
  const rKeyHeldRef = useRef(false);
  const RESET_HOLD_DURATION = 1500;
  const PROGRESS_UPDATE_INTERVAL = 50;

  const currentSegment = event.segments[currentSegmentIndex] ?? null;
  const nextSegment = event.segments[currentSegmentIndex + 1] ?? null;

  const wakeLock = useWakeLock();

  // Auto-scale refs
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Flash effect — isFlashing stays true for entire sequence so it
  // blocks the activeAlertColor fallthrough in the render. flashColor
  // alternates between the color and '' to create the visual blink.
  const triggerFlash = useCallback((color: string) => {
    let count = 0;
    const flash = () => {
      if (count >= 6) {
        setIsFlashing(false);
        setFlashColor('');
        return;
      }
      setIsFlashing(true);
      setFlashColor(count % 2 === 0 ? color : '');
      count++;
      setTimeout(flash, 250);
    };
    flash();
  }, []);

  const handleSegmentComplete = useCallback(() => {
    const seg = event.segments[currentSegmentIndex];
    if (!seg) return;

    if (seg.soundEnabled) {
      audioService.vibrate('finish');
      audioService.playCustom('/sounds/my-alarm.mp3').catch(() => {
        audioService.play('finish');
      });
    }

    if (seg.flashEnabled) {
      // Use last triggered alert color, or red as fallback
      const flashCol = activeAlertColor || '#EF4444';
      triggerFlash(flashCol);
    }

    if (currentSegmentIndex < event.segments.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => audioService.stop(), 2000);
    } else {
      setAllComplete(true);
      setTimeout(() => audioService.stop(), 4000);
    }
  }, [currentSegmentIndex, event.segments, triggerFlash, activeAlertColor]);

  const timer = useTimer({
    segment: currentSegment,
    onComplete: handleSegmentComplete,
    autoStart: !isWaitingSchedule,
    playTickSound: currentSegment?.tickEnabled ?? false,
  });

  // Sort alerts for current segment (high to low for countdown, low to high for countup)
  const sortedAlerts = useMemo(() => {
    if (!currentSegment) return [];
    const alerts = [...currentSegment.colorAlerts];
    if (currentSegment.mode === 'countdown') {
      return alerts.sort((a, b) => b.timeInSeconds - a.timeInSeconds); // 300, 60, 10
    }
    return alerts.sort((a, b) => a.timeInSeconds - b.timeInSeconds); // 10, 60, 300
  }, [currentSegment]);

  // Reset triggered alerts when segment changes
  useEffect(() => {
    triggeredAlertIdsRef.current = new Set();
    setActiveAlertColor('');
  }, [currentSegment?.id]);

  // Color alert checking on each tick
  useEffect(() => {
    if (timer.status !== 'running' || !currentSegment || sortedAlerts.length === 0) return;

    const time = timer.timeInSeconds;

    for (const alert of sortedAlerts) {
      if (triggeredAlertIdsRef.current.has(alert.id)) continue;

      const shouldTrigger = currentSegment.mode === 'countdown'
        ? time <= alert.timeInSeconds  // countdown: trigger when remaining <= threshold
        : time >= alert.timeInSeconds; // countup: trigger when elapsed >= threshold

      if (shouldTrigger) {
        triggeredAlertIdsRef.current.add(alert.id);

        if (alert.background) {
          setActiveAlertColor(alert.color);
        }
        if (alert.sound) {
          audioService.play(alert.timeInSeconds <= 10 ? 'warning' : 'alert');
        }
        if (alert.flash) {
          triggerFlash(alert.color);
        }
      }
    }
  }, [timer.timeInSeconds, timer.status, currentSegment, sortedAlerts, triggerFlash]);

  // Scheduled start countdown
  useEffect(() => {
    if (!isWaitingSchedule || !event.scheduledStartTime) return;
    const tick = () => {
      const diff = event.scheduledStartTime! - Date.now();
      if (diff <= 0) {
        setIsWaitingSchedule(false);
        setScheduleCountdown('');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setScheduleCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isWaitingSchedule, event.scheduledStartTime]);

  // Wake lock
  useEffect(() => {
    if (screenOn || timer.status === 'running') {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [screenOn, timer.status]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      const el = document.documentElement;
      (el.requestFullscreen || (el as any).webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // Auto-scale content
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    const updateScale = () => {
      const style = getComputedStyle(outer);
      const availH = outer.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const availW = outer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const contentH = content.scrollHeight;
      const contentW = content.scrollWidth;
      const scale = Math.min(1, availH / contentH, availW / contentW);
      content.style.transform = scale < 1 ? `scale(${scale})` : '';
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(outer);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // Handle transition complete
  const handleTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
    setCurrentSegmentIndex(prev => prev + 1);
  }, []);

  // Long-press reset logic
  const clearResetTimers = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    resetTimerRef.current = null;
    resetIntervalRef.current = null;
  }, []);

  const handleResetAction = useCallback(() => {
    // When idle or complete, reset acts as exit/back
    if (timer.status === 'idle' || allComplete) {
      audioService.stop();
      onExit();
      return;
    }
    // Otherwise start long-press
    let progress = 0;
    resetIntervalRef.current = window.setInterval(() => {
      progress += (PROGRESS_UPDATE_INTERVAL / RESET_HOLD_DURATION) * 100;
      setResetProgress(Math.min(progress, 100));
    }, PROGRESS_UPDATE_INTERVAL);

    resetTimerRef.current = window.setTimeout(() => {
      audioService.stop();
      onExit();
      clearResetTimers();
      setResetProgress(0);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, RESET_HOLD_DURATION);
  }, [timer.status, allComplete, onExit, clearResetTimers]);

  const handleResetMouseUp = useCallback(() => {
    clearResetTimers();
    setResetProgress(0);
  }, [clearResetTimers]);

  // Exit blackout on any key/tap
  useEffect(() => {
    if (!isBlackout) return;
    const exit = () => setIsBlackout(false);
    window.addEventListener('keydown', exit);
    return () => window.removeEventListener('keydown', exit);
  }, [isBlackout]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (timer.status === 'idle' || allComplete) timer.start();
          else if (timer.status === 'running') timer.pause();
          else if (timer.status === 'paused') timer.resume();
          break;
        case 'KeyR':
          if (!e.metaKey && !e.ctrlKey && !e.repeat) {
            e.preventDefault();
            if (timer.status === 'idle' || allComplete) {
              audioService.stop();
              onExit();
            } else if (!rKeyHeldRef.current) {
              rKeyHeldRef.current = true;
              handleResetAction();
            }
          }
          break;
        case 'KeyF':
          if (!e.metaKey && !e.ctrlKey && canFullscreen && !isStandalone) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'KeyB':
          if (!e.metaKey && !e.ctrlKey && timer.status === 'running') {
            e.preventDefault();
            setIsBlackout(prev => !prev);
          }
          break;
        case 'KeyW':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setScreenOn(prev => !prev);
          }
          break;
        case 'Escape':
          if (isBlackout) setIsBlackout(false);
          else if (isFullscreen) {
            (document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document);
          } else if (timer.status === 'idle' || allComplete) {
            audioService.stop();
            onExit();
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && rKeyHeldRef.current) {
        rKeyHeldRef.current = false;
        handleResetMouseUp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [timer.status, allComplete, isBlackout, isFullscreen, canFullscreen, isStandalone, onExit, handleResetAction, handleResetMouseUp, toggleFullscreen]);

  // Update tab title
  useEffect(() => {
    if (allComplete) {
      document.title = 'Complete - ChronoFlip';
      return;
    }
    if (currentSegment) {
      const t = timer.timeInSeconds;
      const pad = (n: number) => n.toString().padStart(2, '0');
      const hh = Math.floor(t / 3600);
      const mm = Math.floor((t % 3600) / 60);
      const ss = t % 60;
      const timeStr = hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
      const icon = timer.status === 'paused' ? '\u23F8' : '\u23F1';
      const modeLabel = currentSegment.mode === 'countdown' ? 'Countdown' : 'Count Up';
      document.title = `${icon} ${timeStr} ${modeLabel} - ${currentSegment.name} - ChronoFlip`;
    }
    return () => { document.title = 'ChronoFlip Premium'; };
  }, [allComplete, currentSegment, timer.timeInSeconds, timer.status]);

  // Compute display values
  const displaySeconds = timer.timeInSeconds % 60;
  const displayMinutes = Math.floor((timer.timeInSeconds % 3600) / 60);
  const displayHours = Math.floor(timer.timeInSeconds / 3600);
  const showHours = timer.timeInSeconds >= 3600 || (currentSegment?.durationSeconds ?? 0) >= 3600;

  const isScheduledWaiting = isWaitingSchedule;

  // Status badge
  const getStatusBadge = () => {
    const baseClasses = "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border";

    if (isScheduledWaiting) {
      return <span className={`${baseClasses} bg-pink-500/10 border-pink-500/20 text-pink-500`}>Scheduled</span>;
    }
    if (allComplete) {
      return <span className={`${baseClasses} bg-red-500/10 border-red-500/20 text-red-500`}>Complete</span>;
    }
    if (timer.status === 'paused') {
      return <span className={`${baseClasses} bg-amber-500/10 border-amber-500/20 text-amber-500`}>Paused</span>;
    }
    if (timer.status === 'running') {
      const label = currentSegment?.mode === 'countdown' ? 'Countdown' : 'Count-up';
      return <span className={`${baseClasses} bg-emerald-500/10 border-emerald-500/20 text-emerald-500`}>{label}</span>;
    }
    return <span className={`${baseClasses} bg-zinc-500/10 border-zinc-500/20 text-zinc-400`}>Ready</span>;
  };

  return (
    <>
      <div
        ref={outerRef}
        className="h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden transition-colors duration-500"
        style={isFlashing
          ? { backgroundColor: flashColor || 'transparent', transition: 'none' }
          : activeAlertColor
            ? { backgroundColor: activeAlertColor }
            : undefined
        }
      >
        {/* Main Glass Container (matches v1 layout exactly) */}
        <div ref={contentRef} className="relative z-10 flex flex-col items-center">

          {/* Header: Status Badge + Segment Info */}
          <div className="flex flex-col items-center gap-3 mb-8 sm:mb-12 animate-[fadeIn_0.5s_ease-out]">
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              {currentSegment && !allComplete && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {currentSegmentIndex + 1} / {event.segments.length}
                </span>
              )}
            </div>
            {currentSegment && !allComplete && !isScheduledWaiting && (
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-zinc-700 dark:text-zinc-200">
                {currentSegment.name}
              </h2>
            )}
          </div>

          {/* State-specific display */}
          {isScheduledWaiting ? (
            <div className="text-center space-y-6">
              <div className={`
                relative p-4 sm:p-12 md:p-16
                rounded-2xl sm:rounded-[2.5rem]
                bg-white/30 dark:bg-white/5
                backdrop-blur-2xl backdrop-saturate-150
                border border-white/40 dark:border-white/10
                shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
                dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
                transition-all duration-500
              `}>
                <h2 className="text-3xl sm:text-5xl font-bold font-mono tracking-tight text-zinc-800 dark:text-white">
                  {scheduleCountdown}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4">
                  Starting at {new Date(event.scheduledStartTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsWaitingSchedule(false)}
                  className="group relative px-10 py-5 rounded-2xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-600 dark:text-pink-400 font-bold border border-pink-500/30 hover:border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <span className="tracking-widest">START NOW</span>
                  </div>
                </button>
              </div>
            </div>
          ) : allComplete ? (
            <div className={`
              relative p-4 sm:p-12 md:p-16
              rounded-2xl sm:rounded-[2.5rem]
              bg-white/30 dark:bg-white/5
              backdrop-blur-2xl backdrop-saturate-150
              border border-white/40 dark:border-white/10
              shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
              dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
              transition-all duration-500
            `}>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-800 dark:text-white">Timer Complete</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-3">All {event.segments.length} segments finished</p>
            </div>
          ) : (
            <div className={`
              relative
              p-4 sm:p-12 md:p-16
              rounded-2xl sm:rounded-[2.5rem]
              bg-white/30 dark:bg-white/5
              backdrop-blur-2xl backdrop-saturate-150
              border border-white/40 dark:border-white/10
              shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
              dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
              transition-all duration-500
            `}>
              <FlipClockDisplay
                hours={displayHours}
                minutes={displayMinutes}
                seconds={displaySeconds}
                showHours={showHours}
                isRunning={timer.status === 'running'}
              />
            </div>
          )}

          {/* CONTROLS - always visible */}
          <div className="mt-12 flex flex-wrap gap-4 sm:gap-6 justify-center items-center w-full">

            {/* START */}
            {!allComplete && !isScheduledWaiting && timer.status === 'idle' && (
              <button
                type="button"
                onClick={timer.start}
                className={`group relative px-10 py-5 rounded-2xl font-bold backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300 ${
                  activeAlertColor
                    ? 'bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  <span className="tracking-widest">START</span>
                </div>
              </button>
            )}

            {/* PAUSE */}
            {!allComplete && !isScheduledWaiting && timer.status === 'running' && (
              <button
                type="button"
                onClick={timer.pause}
                className={`group relative px-10 py-5 rounded-2xl font-bold backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300 ${
                  activeAlertColor
                    ? 'bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  <span className="tracking-widest">PAUSE</span>
                </div>
              </button>
            )}

            {/* RESUME */}
            {!allComplete && !isScheduledWaiting && timer.status === 'paused' && (
              <button
                type="button"
                onClick={timer.resume}
                className={`group relative px-10 py-5 rounded-2xl font-bold backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300 ${
                  activeAlertColor
                    ? 'bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  <span className="tracking-widest">RESUME</span>
                </div>
              </button>
            )}

            {/* RESET / EXIT - always visible (long-press when running/paused, instant otherwise) */}
            <button
              type="button"
              onMouseDown={handleResetAction}
              onMouseUp={handleResetMouseUp}
              onMouseLeave={handleResetMouseUp}
              onTouchStart={(e) => { e.preventDefault(); handleResetAction(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleResetMouseUp(); }}
              title={timer.status === 'running' || timer.status === 'paused' ? 'Hold to Exit (1.5s)' : 'Exit (R)'}
              aria-label="Reset and exit timer"
              className="relative px-6 py-5 rounded-2xl bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white font-bold border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md overflow-hidden"
            >
              {resetProgress > 0 && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: `conic-gradient(rgba(239,68,68,0.4) ${resetProgress}%, transparent ${resetProgress}%)` }}
                />
              )}
              <svg className="w-6 h-6 stroke-current relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
              </svg>
            </button>

            {/* Screen On */}
            <button
              type="button"
              onClick={() => setScreenOn(prev => !prev)}
              title={screenOn ? "Allow Screen Sleep (W)" : "Keep Screen On (W)"}
              aria-label={screenOn ? "Allow screen to sleep" : "Keep screen awake"}
              className={`px-6 py-5 rounded-2xl font-bold border hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md ${
                screenOn
                  ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-white/10 dark:bg-black/20 text-gray-600 dark:text-white border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/5'
              }`}
            >
              {screenOn ? (
                <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
              ) : (
                <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
              )}
            </button>

            {/* Fullscreen */}
            {canFullscreen && !isStandalone && (
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
            )}

            {/* Blackout */}
            {!allComplete && !isScheduledWaiting && timer.status === 'running' && (
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
      </div>

      {/* Segment Transition Overlay */}
      {isTransitioning && nextSegment && currentSegment && (
        <SegmentTransition
          fromName={currentSegment.name}
          toName={nextSegment.name}
          toColor={nextSegment.colorAlerts[0]?.color ?? '#3B82F6'}
          onComplete={handleTransitionComplete}
        />
      )}

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
    </>
  );
};

export default TimerRunningScreen;
