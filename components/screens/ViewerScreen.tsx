import React, { useState, useEffect, useRef } from 'react';
import type { SpeechEvent, TimerSyncState } from '../../types';
import { fetchSharedEvent, subscribeToTimerState } from '../../services/syncService';
import FlipClockDisplay from '../FlipClockDisplay';

interface ViewerScreenProps {
  shareId: string;
}

const ViewerScreen: React.FC<ViewerScreenProps> = ({ shareId }) => {
  const [event, setEvent] = useState<SpeechEvent | null>(null);
  const [timerState, setTimerState] = useState<TimerSyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const timerStateRef = useRef<TimerSyncState | null>(null);
  const hadStateRef = useRef(false);

  // Force light mode for viewer
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body.classList.add('light-mesh-bg');
  }, []);

  // Fetch event data
  useEffect(() => {
    fetchSharedEvent(shareId)
      .then((data) => {
        if (!data) {
          setError(true);
        } else {
          setEvent(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [shareId]);

  // Subscribe to live timer state — only after event loads successfully
  useEffect(() => {
    if (!event) return;
    const unsubscribe = subscribeToTimerState(shareId, (state) => {
      if (state) {
        hadStateRef.current = true;
      } else if (hadStateRef.current) {
        setRemoved(true);
      }
      timerStateRef.current = state;
      setTimerState(state);
      setIsStale(false);
    });
    return unsubscribe;
  }, [shareId, event]);

  // Staleness detection — check every 5s if last update is >10s old
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = timerStateRef.current;
      if (s && s.status === 'running' && Date.now() - s.lastUpdatedAt > 10000) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Update tab title
  useEffect(() => {
    if (timerState) {
      document.title = `${timerState.eventTitle} — Live Timer`;
    }
    return () => { document.title = 'ChronoFlip'; };
  }, [timerState?.eventTitle]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-3 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Loading timer...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (error || !event) {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl mb-2">?</div>
          <h1 className="text-xl font-bold text-white">Timer Not Found</h1>
          <p className="text-zinc-400 text-sm">
            This link may have expired or the event was removed. Ask the organizer for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Event was removed by organizer after viewer was already connected
  if (removed) {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-bold text-white">Timer Ended</h1>
          <p className="text-zinc-400 text-sm">
            This timer session has ended. Thanks for watching!
          </p>
        </div>
      </div>
    );
  }

  // Compute display
  const state = timerState;
  const time = state?.timeInSeconds ?? 0;
  const displayHours = Math.floor(time / 3600);
  const displayMinutes = Math.floor((time % 3600) / 60);
  const displaySeconds = time % 60;
  const showHours = time >= 3600;

  const bgColor = state?.activeAlertColor ?? undefined;
  const status = state?.status ?? 'waiting';

  const getStatusBadge = () => {
    const base = "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border";
    switch (status) {
      case 'running': {
        const label = state?.segmentMode === 'countdown' ? 'Countdown' : 'Count-up';
        return <span className={`${base} bg-emerald-500/10 border-emerald-500/20 text-emerald-500`}>{label}</span>;
      }
      case 'paused':
        return <span className={`${base} bg-amber-500/10 border-amber-500/20 text-amber-500`}>Paused</span>;
      case 'completed':
        return <span className={`${base} bg-red-500/10 border-red-500/20 text-red-500`}>Complete</span>;
      default:
        return <span className={`${base} bg-zinc-500/10 border-zinc-500/20 text-zinc-400`}>Waiting</span>;
    }
  };

  return (
    <div
      className="h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden transition-colors duration-500"
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >


      <div className="relative z-10 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8 sm:mb-12 animate-[fadeIn_0.5s_ease-out]">
          <h1 className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
            {state?.eventTitle ?? event.title}
          </h1>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            {state && status !== 'completed' && (
              <span className="text-xs text-zinc-500">
                {(state.currentSegmentIndex ?? 0) + 1} / {state.totalSegments ?? event.segments?.length ?? 0}
              </span>
            )}
          </div>
          {state && status !== 'completed' && status !== 'waiting' && (
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-zinc-200">
              {state.segmentName}
            </h2>
          )}
        </div>

        {/* Timer display */}
        {status === 'completed' ? (
          <div className="relative p-4 sm:p-12 md:p-16 rounded-2xl sm:rounded-[2.5rem]
                          bg-white/5 backdrop-blur-2xl backdrop-saturate-150
                          border border-white/10
                          shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Timer Complete</h2>
            <p className="text-zinc-400 text-sm mt-3">
              All {state?.totalSegments ?? event.segments?.length ?? 0} segments finished
            </p>
          </div>
        ) : status === 'waiting' ? (
          <div className="relative p-4 sm:p-12 md:p-16 rounded-2xl sm:rounded-[2.5rem]
                          bg-white/5 backdrop-blur-2xl backdrop-saturate-150
                          border border-white/10
                          shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
                          text-center">
            <p className="text-zinc-300 text-lg font-semibold">Waiting to start</p>
            {state?.scheduledStartTime && state.scheduledStartTime > Date.now() && (
              <p className="text-zinc-500 text-sm mt-3">
                Scheduled for {new Date(state.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ) : (
          <div className="relative p-4 sm:p-12 md:p-16 rounded-2xl sm:rounded-[2.5rem]
                          bg-white/5 backdrop-blur-2xl backdrop-saturate-150
                          border border-white/10
                          shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <FlipClockDisplay
              hours={displayHours}
              minutes={displayMinutes}
              seconds={displaySeconds}
              showHours={showHours}
              isRunning={status === 'running'}
            />
          </div>
        )}

        {/* Stale connection warning */}
        {isStale && (
          <p className="mt-4 text-xs text-amber-400/80 animate-pulse">
            Connection may be lost — waiting for update...
          </p>
        )}

        {/* Powered by branding */}
        <p className="mt-8 text-[10px] text-zinc-600 tracking-wide">
          Powered by ChronoFlip
        </p>
      </div>
    </div>
  );
};

export default ViewerScreen;
