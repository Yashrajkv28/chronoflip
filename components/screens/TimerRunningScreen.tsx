import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import type { SpeechEvent, TimerSyncState, ViewerCommand } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { useWakeLock } from '../../hooks/useWakeLock';
import { audioService } from '../../services/audioService';
import { publishTimerState, subscribeToCommand, clearCommand } from '../../services/syncService';
import FlipClockDisplay from '../FlipClockDisplay';
import SegmentTransition from '../ui/SegmentTransition';

interface TimerRunningScreenProps {
  event: SpeechEvent;
  startSegmentIndex: number;
  onExit: () => void;
  activeGroupId?: string;
  groupSegmentIndices?: number[];
  onGroupChange?: (groupId: string, segmentIndices: number[]) => void;
}

const TimerRunningScreen: React.FC<TimerRunningScreenProps> = ({
  event,
  startSegmentIndex,
  onExit,
  activeGroupId,
  groupSegmentIndices = [],
  onGroupChange,
}) => {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(startSegmentIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashColor, setFlashColor] = useState('');
  const [isFlashBlocking, setIsFlashBlocking] = useState(false);
  const flashIntervalRef = useRef<number | null>(null);
  const [isWaitingSchedule, setIsWaitingSchedule] = useState(() => {
    return event.scheduledStartTime != null && event.scheduledStartTime > Date.now();
  });
  const [scheduleCountdown, setScheduleCountdown] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStandalone] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
  const [canFullscreen] = useState(() =>
    !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled)
  );

  // Restart / force-idle
  const [forceIdle, setForceIdle] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Exit button long-press
  const [exitProgress, setExitProgress] = useState(0);
  const exitTimerRef = useRef<number | null>(null);
  const exitIntervalRef = useRef<number | null>(null);
  const eKeyHeldRef = useRef(false);
  const EXIT_HOLD_DURATION = 3000;

  // Long-press restart
  const [restartProgress, setRestartProgress] = useState(0);
  const restartTimerRef = useRef<number | null>(null);
  const restartIntervalRef = useRef<number | null>(null);
  const rKeyHeldRef = useRef(false);
  const RESTART_HOLD_DURATION = 1500;
  const PROGRESS_UPDATE_INTERVAL = 50;

  const isGroupMode = !!activeGroupId && groupSegmentIndices.length > 0;

  // In group mode, only iterate through group's segments
  const effectiveSegments = isGroupMode
    ? groupSegmentIndices.map(i => event.segments[i]).filter(Boolean)
    : event.segments;

  const currentSegment = effectiveSegments[currentSegmentIndex] ?? null;
  const nextSegment = effectiveSegments[currentSegmentIndex + 1] ?? null;

  // Map local index to global index for sync
  const localToGlobalIndex = (localIdx: number): number => {
    if (!isGroupMode) return localIdx;
    return groupSegmentIndices[localIdx] ?? localIdx;
  };

  // Find adjacent groups for prev/next navigation
  const findAdjacentGroups = () => {
    if (!activeGroupId) return { prevGroupId: null, nextGroupId: null };
    const groupIds: string[] = [];
    let lastGroupId: string | null = null;
    for (const seg of event.segments) {
      if (seg.groupId && seg.groupId !== lastGroupId) {
        groupIds.push(seg.groupId);
        lastGroupId = seg.groupId;
      } else if (!seg.groupId) {
        lastGroupId = null;
      }
    }
    const currentIdx = groupIds.indexOf(activeGroupId);
    return {
      prevGroupId: currentIdx > 0 ? groupIds[currentIdx - 1] : null,
      nextGroupId: currentIdx < groupIds.length - 1 ? groupIds[currentIdx + 1] : null,
    };
  };

  const { prevGroupId, nextGroupId } = findAdjacentGroups();
  const activeGroupName = event.groups?.find(g => g.id === activeGroupId)?.name;

  const wakeLock = useWakeLock();

  // Auto-scale refs
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Start continuous blocking flash (0.5s interval, infinite until dismissed)
  const startBlockingFlash = useCallback((color: string) => {
    // Clear any existing flash interval
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
    }

    let isColorOn = true;
    setIsFlashing(true);
    setFlashColor(color);
    setIsFlashBlocking(true);

    flashIntervalRef.current = window.setInterval(() => {
      isColorOn = !isColorOn;
      setFlashColor(isColorOn ? color : '');
    }, 500);
  }, []);

  // Dismiss flash and proceed to next segment (or complete)
  const dismissFlash = useCallback(() => {
    // Stop the flash interval
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    setIsFlashing(false);
    setFlashColor('');
    setIsFlashBlocking(false);
    audioService.stop();

    // Now advance to next segment or mark all complete
    if (currentSegmentIndex < effectiveSegments.length - 1) {
      setIsTransitioning(true);
    } else {
      setAllComplete(true);
    }
  }, [currentSegmentIndex, effectiveSegments.length]);

  // Cleanup flash interval on unmount
  useEffect(() => {
    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, []);

  const handleSegmentComplete = useCallback(() => {
    const seg = effectiveSegments[currentSegmentIndex];
    if (!seg) return;

    // Play alarm sound if enabled
    if (seg.soundEnabled) {
      audioService.vibrate('finish');
      audioService.playCustom('/sounds/my-alarm.mp3').catch(() => {
        audioService.play('finish');
      });
    }

    if (seg.flashEnabled) {
      // Start blocking flash — prevents auto-advance until user dismisses
      startBlockingFlash(seg.color);
      // Do NOT set isTransitioning or allComplete here
    } else {
      // Normal auto-advance (no flash blocking)
      if (currentSegmentIndex < effectiveSegments.length - 1) {
        setIsTransitioning(true);
        setTimeout(() => audioService.stop(), 2000);
      } else {
        setAllComplete(true);
        setTimeout(() => audioService.stop(), 4000);
      }
    }
  }, [currentSegmentIndex, effectiveSegments, startBlockingFlash]);

  const timer = useTimer({
    segment: currentSegment,
    onComplete: handleSegmentComplete,
    autoStart: !isWaitingSchedule && !forceIdle,
    playTickSound: currentSegment?.tickEnabled ?? false,
    resetKey,
  });

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
    if (timer.status === 'running') {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [timer.status]);

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

  // Long-press restart logic
  const clearRestartTimers = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (restartIntervalRef.current) clearInterval(restartIntervalRef.current);
    restartTimerRef.current = null;
    restartIntervalRef.current = null;
  }, []);

  const clearExitTimers = useCallback(() => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
    exitTimerRef.current = null;
    exitIntervalRef.current = null;
  }, []);

  const executeRestart = useCallback(() => {
    // Stop all audio
    audioService.stop();

    // Clear any active flash
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    setIsFlashing(false);
    setFlashColor('');
    setIsFlashBlocking(false);

    // Clear transition and completion states
    setIsTransitioning(false);
    setAllComplete(false);

    // Force idle and go to segment 0
    setForceIdle(true);
    setCurrentSegmentIndex(0);
    setResetKey(prev => prev + 1);

    if ('vibrate' in navigator) navigator.vibrate(50);
  }, []);

  const handleRestartAction = useCallback(() => {
    // Always long-press — start progress animation
    let progress = 0;
    restartIntervalRef.current = window.setInterval(() => {
      progress += (PROGRESS_UPDATE_INTERVAL / RESTART_HOLD_DURATION) * 100;
      setRestartProgress(Math.min(progress, 100));
    }, PROGRESS_UPDATE_INTERVAL);

    restartTimerRef.current = window.setTimeout(() => {
      executeRestart();
      clearRestartTimers();
      setRestartProgress(0);
    }, RESTART_HOLD_DURATION);
  }, [clearRestartTimers, executeRestart]);

  const handleRestartMouseUp = useCallback(() => {
    clearRestartTimers();
    setRestartProgress(0);
  }, [clearRestartTimers]);

  const handleExitAction = useCallback(() => {
    // Always long-press — start progress animation
    let progress = 0;
    exitIntervalRef.current = window.setInterval(() => {
      progress += (PROGRESS_UPDATE_INTERVAL / EXIT_HOLD_DURATION) * 100;
      setExitProgress(Math.min(progress, 100));
    }, PROGRESS_UPDATE_INTERVAL);

    exitTimerRef.current = window.setTimeout(() => {
      audioService.stop();
      // Clear any active flash
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      onExit();
      clearExitTimers();
      setExitProgress(0);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, EXIT_HOLD_DURATION);
  }, [onExit, clearExitTimers]);

  const handleExitMouseUp = useCallback(() => {
    clearExitTimers();
    setExitProgress(0);
  }, [clearExitTimers]);

  const handleManualStart = useCallback(() => {
    setForceIdle(false);
    timer.start();
  }, [timer]);

  const navigateToGroup = useCallback((targetGroupId: string) => {
    audioService.stop();
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    setIsFlashing(false);
    setFlashColor('');
    setIsFlashBlocking(false);
    setIsTransitioning(false);
    setAllComplete(false);
    setForceIdle(true);
    setCurrentSegmentIndex(0);
    setResetKey(prev => prev + 1);

    const targetIndices = event.segments
      .map((s, i) => s.groupId === targetGroupId ? i : -1)
      .filter(i => i >= 0);

    onGroupChange?.(targetGroupId, targetIndices);
    if ('vibrate' in navigator) navigator.vibrate(50);
  }, [event.segments, onGroupChange]);

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
          if (isFlashBlocking) {
            dismissFlash();
          } else if (timer.status === 'idle' || allComplete) {
            handleManualStart();
          } else if (timer.status === 'running') {
            timer.pause();
          } else if (timer.status === 'paused') {
            timer.resume();
          }
          break;
        case 'KeyR':
          if (!e.metaKey && !e.ctrlKey && !e.repeat) {
            e.preventDefault();
            if (!rKeyHeldRef.current) {
              rKeyHeldRef.current = true;
              handleRestartAction();
            }
          }
          break;
        case 'KeyE':
          if (!e.metaKey && !e.ctrlKey && !e.repeat) {
            e.preventDefault();
            if (!eKeyHeldRef.current) {
              eKeyHeldRef.current = true;
              handleExitAction();
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
        case 'BracketLeft':
        case 'KeyP':
          if (!e.metaKey && !e.ctrlKey && isGroupMode && prevGroupId) {
            e.preventDefault();
            navigateToGroup(prevGroupId);
          }
          break;
        case 'BracketRight':
        case 'KeyN':
          if (!e.metaKey && !e.ctrlKey && isGroupMode && nextGroupId) {
            e.preventDefault();
            navigateToGroup(nextGroupId);
          }
          break;
        case 'Escape':
          if (isFlashBlocking) {
            dismissFlash();
          } else if (isBlackout) {
            setIsBlackout(false);
          } else if (isFullscreen) {
            (document.exitFullscreen || (document as any).webkitExitFullscreen)?.call(document);
          }
          // NOTE: Escape no longer exits to edit screen — use E key (3s hold) instead
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && rKeyHeldRef.current) {
        rKeyHeldRef.current = false;
        handleRestartMouseUp();
      }
      if (e.code === 'KeyE' && eKeyHeldRef.current) {
        eKeyHeldRef.current = false;
        handleExitMouseUp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [timer.status, allComplete, isBlackout, isFullscreen, canFullscreen, isStandalone, handleRestartAction, handleRestartMouseUp, handleExitAction, handleExitMouseUp, toggleFullscreen, isFlashBlocking, dismissFlash, handleManualStart, isGroupMode, prevGroupId, nextGroupId, navigateToGroup]);

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

  // Remote command handler ref (avoids stale closures in subscription listener)
  const commandHandlerRef = useRef<((cmd: ViewerCommand) => void) | null>(null);
  const lastProcessedCommandRef = useRef<number>(0);

  // Keep command handler in sync with latest state/callbacks
  commandHandlerRef.current = (cmd: ViewerCommand) => {
    // Ignore stale commands (older than 10 seconds)
    if (Date.now() - cmd.timestamp > 10000) return;
    // Ignore already-processed commands
    if (cmd.timestamp <= lastProcessedCommandRef.current) return;
    lastProcessedCommandRef.current = cmd.timestamp;

    switch (cmd.type) {
      case 'start':
        if (isFlashBlocking) {
          dismissFlash();
        } else if (timer.status === 'idle' || allComplete) {
          handleManualStart();
        } else if (timer.status === 'paused') {
          timer.resume();
        }
        break;
      case 'pause':
        if (timer.status === 'running') {
          timer.pause();
        }
        break;
      case 'restart':
        executeRestart();
        break;
    }
  };

  // Subscribe to viewer commands (remote control)
  useEffect(() => {
    if (!event.shareId) return;

    const unsubscribe = subscribeToCommand(event.shareId, (cmd) => {
      if (cmd) {
        commandHandlerRef.current?.(cmd);
        clearCommand(event.shareId!).catch(() => {});
      }
    });

    return unsubscribe;
  }, [event.shareId]);

  // Sync timer state to AppSync for viewers
  const syncTimeoutRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string>('');
  useEffect(() => {
    if (!event.shareId) return;

    const buildState = (): TimerSyncState => {
      let syncStatus: TimerSyncState['status'];
      if (allComplete) syncStatus = 'completed';
      else if (isWaitingSchedule) syncStatus = 'waiting';
      else if (timer.status === 'paused') syncStatus = 'paused';
      else if (timer.status === 'running') syncStatus = 'running';
      else syncStatus = 'waiting';

      return {
        status: syncStatus,
        currentSegmentIndex: isGroupMode ? localToGlobalIndex(currentSegmentIndex) : currentSegmentIndex,
        timeInSeconds: timer.timeInSeconds,
        segmentName: currentSegment?.name ?? '',
        segmentMode: currentSegment?.mode ?? 'countdown',
        totalSegments: effectiveSegments.length,
        activeAlertColor: currentSegment?.color ?? null,
        isFlashing: isFlashBlocking,
        lastUpdatedAt: Date.now(),
        eventTitle: event.title,
        scheduledStartTime: event.scheduledStartTime ?? null,
        activeGroupId: activeGroupId ?? undefined,
      };
    };

    // Publish immediately on status changes (start/pause/resume/complete)
    const currentStatus = allComplete ? 'completed' : timer.status;
    const statusChanged = currentStatus !== prevStatusRef.current;
    prevStatusRef.current = currentStatus;

    if (statusChanged) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
      publishTimerState(event.shareId!, buildState()).catch(() => {});
      return;
    }

    // Debounce regular ticks at 300ms
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      publishTimerState(event.shareId!, buildState()).catch(() => {});
    }, 300);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [timer.timeInSeconds, timer.status, allComplete, isWaitingSchedule, currentSegmentIndex, isFlashBlocking, event.shareId, event.title, effectiveSegments.length, event.scheduledStartTime, currentSegment?.name, currentSegment?.mode, currentSegment?.color, isGroupMode, activeGroupId]);

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
          : currentSegment?.color && !allComplete
            ? { backgroundColor: currentSegment.color }
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
                <span className="text-xs text-zinc-400">
                  {currentSegmentIndex + 1} / {effectiveSegments.length}
                </span>
              )}
            </div>
            {activeGroupName && !allComplete && !isScheduledWaiting && (
              <h3 className="text-sm font-semibold text-zinc-400 tracking-wide">
                {activeGroupName}
              </h3>
            )}
            {currentSegment && !allComplete && !isScheduledWaiting && (
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-zinc-700">
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
                bg-white/30
                backdrop-blur-2xl backdrop-saturate-150
                border border-white/40
                shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
                transition-all duration-500
              `}>
                <h2 className="text-3xl sm:text-5xl font-bold font-mono tracking-tight text-zinc-800">
                  {scheduleCountdown}
                </h2>
                <p className="text-sm text-zinc-500 mt-4">
                  Starting at {new Date(event.scheduledStartTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsWaitingSchedule(false)}
                  className="group relative px-10 py-5 rounded-2xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-600 font-bold border border-pink-500/30 hover:border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
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
              bg-white/30
              backdrop-blur-2xl backdrop-saturate-150
              border border-white/40
              shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
              transition-all duration-500
            `}>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-800">
                {isGroupMode ? 'Group Complete' : 'Timer Complete'}
              </h2>
              <p className="text-zinc-500 text-sm mt-3">
                {isGroupMode
                  ? `All ${effectiveSegments.length} timers in "${activeGroupName}" finished`
                  : `All ${event.segments.length} segments finished`}
              </p>
            </div>
          ) : (
            <div className={`
              relative
              p-4 sm:p-12 md:p-16
              rounded-2xl sm:rounded-[2.5rem]
              bg-white/30
              backdrop-blur-2xl backdrop-saturate-150
              border border-white/40
              shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.4)]
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
                onClick={handleManualStart}
                className={`group relative px-10 py-5 rounded-2xl font-bold backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300 ${
                  currentSegment?.color
                    ? 'bg-white/10 text-gray-600 border border-white/20 hover:bg-white/20'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]'
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
                  currentSegment?.color
                    ? 'bg-white/10 text-gray-600 border border-white/20 hover:bg-white/20'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 border border-amber-500/30 hover:border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]'
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
                  currentSegment?.color
                    ? 'bg-white/10 text-gray-600 border border-white/20 hover:bg-white/20'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  <span className="tracking-widest">RESUME</span>
                </div>
              </button>
            )}

            {/* RESTART - always visible, always 1.5s hold */}
            <button
              type="button"
              onMouseDown={handleRestartAction}
              onMouseUp={handleRestartMouseUp}
              onMouseLeave={handleRestartMouseUp}
              onTouchStart={(e) => { e.preventDefault(); handleRestartAction(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleRestartMouseUp(); }}
              title="Restart from first segment (hold 1.5s) (R)"
              aria-label="Restart timer from first segment"
              className="relative px-6 py-5 rounded-2xl bg-white/10 text-gray-600 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md overflow-hidden"
            >
              {restartProgress > 0 && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: `conic-gradient(rgba(59,130,246,0.4) ${restartProgress}%, transparent ${restartProgress}%)` }}
                />
              )}
              <svg className="w-6 h-6 stroke-current relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
              </svg>
            </button>

            {/* Prev Group */}
            {isGroupMode && prevGroupId && (
              <button
                type="button"
                onClick={() => navigateToGroup(prevGroupId)}
                title="Previous Group ([)"
                aria-label="Go to previous group"
                className="px-6 py-5 rounded-2xl bg-white/10 text-gray-600 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
              >
                <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}

            {/* Next Group */}
            {isGroupMode && nextGroupId && (
              <button
                type="button"
                onClick={() => navigateToGroup(nextGroupId)}
                title="Next Group (])"
                aria-label="Go to next group"
                className="px-6 py-5 rounded-2xl bg-white/10 text-gray-600 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
              >
                <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}

            {/* EXIT - always visible, always 3s hold */}
            <button
              type="button"
              onMouseDown={handleExitAction}
              onMouseUp={handleExitMouseUp}
              onMouseLeave={handleExitMouseUp}
              onTouchStart={(e) => { e.preventDefault(); handleExitAction(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleExitMouseUp(); }}
              title="Exit to edit screen (hold 3s) (E)"
              aria-label="Exit timer and return to edit screen"
              className="relative px-6 py-5 rounded-2xl bg-white/10 text-gray-600 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md overflow-hidden"
            >
              {exitProgress > 0 && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: `conic-gradient(rgba(239,68,68,0.4) ${exitProgress}%, transparent ${exitProgress}%)` }}
                />
              )}
              <svg className="w-6 h-6 stroke-current relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>

            {/* Fullscreen */}
            {canFullscreen && !isStandalone && (
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                aria-label={isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
                className="px-6 py-5 rounded-2xl bg-white/10 text-gray-600 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
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
                className="px-6 py-5 rounded-2xl bg-white/10 text-gray-600 font-bold border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-md"
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
          toColor={nextSegment.color}
          onComplete={handleTransitionComplete}
        />
      )}

      {/* Flash Blocking Overlay — user must dismiss to proceed */}
      {isFlashBlocking && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center cursor-pointer"
          onClick={dismissFlash}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); dismissFlash(); }}
            className="px-12 py-6 rounded-2xl bg-black/30 backdrop-blur-xl text-white font-bold text-xl border border-white/30 hover:bg-black/40 active:scale-95 transition-all shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span className="tracking-widest">STOP</span>
            </div>
          </button>
          <p className="mt-4 text-white/60 text-sm select-none">
            Tap anywhere or press Space to continue
          </p>
        </div>
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
