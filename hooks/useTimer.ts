import { useState, useEffect, useRef, useCallback } from 'react';
import { audioService } from '../services/audioService';
import type { Segment, SegmentStatus } from '../types';

interface UseTimerOptions {
  segment: Segment | null;
  onComplete: () => void;
  autoStart?: boolean;
  playTickSound?: boolean;
}

interface UseTimerReturn {
  timeInSeconds: number;
  status: SegmentStatus;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useTimer({ segment, onComplete, autoStart = false, playTickSound = false }: UseTimerOptions): UseTimerReturn {
  const [status, setStatus] = useState<SegmentStatus>('idle');
  const [timeInSeconds, setTimeInSeconds] = useState(() =>
    segment ? (segment.mode === 'countdown' ? segment.durationSeconds : 0) : 0
  );

  // Timestamp-based timing refs (immune to browser throttling)
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef<number>(0);
  const initialTimeRef = useRef<number>(segment?.durationSeconds ?? 0);
  const intervalRef = useRef<number | null>(null);
  const lastTickSecondRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const segmentRef = useRef(segment);

  // Keep refs in sync
  onCompleteRef.current = onComplete;
  segmentRef.current = segment;

  // Reset when segment changes
  useEffect(() => {
    if (!segment) return;

    // Clear any running interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    initialTimeRef.current = segment.durationSeconds;
    startTimeRef.current = null;
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    lastTickSecondRef.current = null;
    setTimeInSeconds(segment.mode === 'countdown' ? segment.durationSeconds : 0);

    if (autoStart) {
      audioService.play('start');
      setStatus('running');
    } else {
      setStatus('idle');
    }
  }, [segment?.id, autoStart]);

  const start = useCallback(() => {
    if (!segmentRef.current) return;
    startTimeRef.current = null; // Will be set in tick effect
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    initialTimeRef.current = segmentRef.current.durationSeconds;
    lastTickSecondRef.current = null;
    setTimeInSeconds(segmentRef.current.mode === 'countdown' ? segmentRef.current.durationSeconds : 0);
    audioService.play('start');
    setStatus('running');
  }, []);

  const pause = useCallback(() => {
    pausedAtRef.current = Date.now();
    audioService.play('pause');
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (pausedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    audioService.play('start');
    setStatus('running');
  }, []);

  const reset = useCallback(() => {
    audioService.stop();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    lastTickSecondRef.current = null;
    if (segmentRef.current) {
      initialTimeRef.current = segmentRef.current.durationSeconds;
      setTimeInSeconds(segmentRef.current.mode === 'countdown' ? segmentRef.current.durationSeconds : 0);
    }
    setStatus('idle');
  }, []);

  // Main timer tick
  useEffect(() => {
    if (status !== 'running' || !segment) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTimeRef.current! - totalPausedMsRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      // Tick sound on new second
      if (lastTickSecondRef.current !== elapsedSeconds) {
        lastTickSecondRef.current = elapsedSeconds;
        if (playTickSound) {
          audioService.play('tick', false);
        }
      }

      const seg = segmentRef.current;
      if (!seg) return;

      if (seg.mode === 'countdown') {
        const remaining = Math.max(0, initialTimeRef.current - elapsedSeconds);
        setTimeInSeconds(remaining);

        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setStatus('completed');
          onCompleteRef.current();
        }
      } else {
        // Countup
        setTimeInSeconds(elapsedSeconds);

        if (seg.durationSeconds > 0 && elapsedSeconds >= seg.durationSeconds) {
          setTimeInSeconds(seg.durationSeconds);
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setStatus('completed');
          onCompleteRef.current();
        }
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, segment?.id, segment?.mode, segment?.durationSeconds, playTickSound]);

  return { timeInSeconds, status, start, pause, resume, reset };
}
