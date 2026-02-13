import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { SpeechEvent } from '../../types';
import SegmentCard from '../ui/SegmentCard';

interface EventSettingsScreenProps {
  event: SpeechEvent;
  onBack: () => void;
  onUpdateEvent: (updates: Partial<SpeechEvent>) => void;
  onAddSegment: () => void;
  onEditSegment: (segmentId: string) => void;
  onDeleteSegment: (segmentId: string) => void;
  onReorderSegments: (activeId: string, overId: string) => void;
  onStartEvent: (startSegmentIndex?: number) => void;
  onScheduleStart: (scheduledTime: number) => void;
}

const EventSettingsScreen: React.FC<EventSettingsScreenProps> = ({
  event,
  onBack,
  onUpdateEvent,
  onAddSegment,
  onEditSegment,
  onDeleteSegment,
  onReorderSegments,
  onStartEvent,
  onScheduleStart,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(event.title);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [schedError, setSchedError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorderSegments(active.id as string, over.id as string);
    }
  };

  const handleTitleSave = () => {
    if (titleValue.trim()) {
      onUpdateEvent({ title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  const handleScheduleStart = () => {
    if (!schedDate || !schedTime) return;
    const scheduled = new Date(`${schedDate}T${schedTime}`).getTime();
    if (isNaN(scheduled)) {
      setSchedError('Invalid date or time');
      return;
    }
    if (scheduled <= Date.now()) {
      setSchedError('Time must be in the future');
      return;
    }
    setSchedError('');
    onScheduleStart(scheduled);
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-2xl mx-auto">
          {/* Top row: back, title, actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 -ml-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-white/20 dark:hover:bg-white/5 transition-all"
              aria-label="Back to event list"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className="flex-1 text-center">
              {editingTitle ? (
                <input
                  type="text"
                  value={titleValue}
                  onChange={e => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                  autoFocus
                  className="w-full text-center text-lg font-bold bg-transparent border-b-2 border-blue-500/50 text-zinc-800 dark:text-white outline-none py-1"
                />
              ) : (
                <h1
                  onClick={() => { setTitleValue(event.title); setEditingTitle(true); }}
                  className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-white truncate cursor-pointer hover:opacity-70 transition-opacity"
                >
                  {event.title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold backdrop-blur-xl border shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 ${
                  editMode
                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
                    : 'bg-white/20 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 border-white/30 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/10'
                }`}
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Dynamic duration + schedule info bar */}
          {(() => {
            const totalSec = event.segments.reduce((sum, s) => sum + s.durationSeconds, 0);
            if (totalSec === 0 && !event.scheduledStartTime) return null;

            const fmtDur = (sec: number) => {
              const hh = Math.floor(sec / 3600);
              const mm = Math.floor((sec % 3600) / 60);
              const ss = sec % 60;
              if (hh > 0) return `${hh}h ${mm}m`;
              if (mm > 0 && ss > 0) return `${mm}m ${ss}s`;
              if (mm > 0) return `${mm}m`;
              return `${ss}s`;
            };

            const fmtTime = (ts: number) =>
              new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const hasSchedule = event.scheduledStartTime != null && event.scheduledStartTime > 0;
            const endTs = hasSchedule ? event.scheduledStartTime! + totalSec * 1000 : 0;

            return (
              <div className="flex items-center justify-center gap-3 mt-4">
                {/* Total duration pill */}
                {totalSec > 0 && (
                  <span className="px-5 py-2 rounded-full text-sm font-semibold font-mono
                                   bg-purple-500/10 border border-purple-500/20 text-purple-500 dark:text-purple-400">
                    {fmtDur(totalSec)}
                  </span>
                )}
                {/* Scheduled time range */}
                {hasSchedule && totalSec > 0 && (
                  <span className="px-4 py-1.5 rounded-full text-xs font-semibold
                                   bg-pink-500/10 border border-pink-500/20 text-pink-500 dark:text-pink-400">
                    {fmtTime(event.scheduledStartTime!)} → {fmtTime(endTs)}
                  </span>
                )}
              </div>
            );
          })()}

          {/* START all & ADD buttons */}
          <div className="flex items-center justify-center gap-4 mt-5">
            {event.segments.length > 0 && (
              <button
                type="button"
                onClick={() => onStartEvent()}
                className="px-7 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider
                           bg-emerald-500/15 text-emerald-600 dark:text-emerald-400
                           border border-emerald-500/25
                           hover:bg-emerald-500/25 hover:border-emerald-500/40
                           shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]
                           hover:scale-105 active:scale-95
                           backdrop-blur-xl transition-all duration-300"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  START
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={onAddSegment}
              className="p-3 rounded-2xl
                         bg-white/20 dark:bg-white/5
                         backdrop-blur-xl
                         border border-white/30 dark:border-white/10
                         text-zinc-600 dark:text-zinc-300
                         hover:bg-white/30 dark:hover:bg-white/10
                         hover:scale-110 active:scale-95
                         transition-all duration-300 shadow-lg"
              aria-label="Add segment"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Segment List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        <div className="max-w-2xl mx-auto space-y-2">
          {event.segments.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                No segments yet. Tap + to add a speech.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={event.segments.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {event.segments.map((segment, index) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    editMode={editMode}
                    onEdit={() => onEditSegment(segment.id)}
                    onStart={() => onStartEvent(index)}
                    onDelete={() => onDeleteSegment(segment.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Schedule Start Section */}
        {event.segments.length > 0 && (
          <div className="max-w-2xl mx-auto mt-8">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500 mb-2 px-1">
              Scheduled Start
            </h3>
            <div className="p-5 rounded-2xl
                            bg-zinc-50/80 dark:bg-zinc-900/40
                            backdrop-blur-xl
                            border border-zinc-200/50 dark:border-white/10">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-4">
                Start at specific time
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className="flex-1 min-w-0 bg-white/60 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all"
                />
                <input
                  type="time"
                  value={schedTime}
                  onChange={e => setSchedTime(e.target.value)}
                  className="flex-1 min-w-0 bg-white/60 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleScheduleStart}
                disabled={!schedDate || !schedTime}
                className="w-full mt-4 px-5 py-3.5 rounded-2xl text-sm font-bold
                           bg-pink-500/15 text-pink-600 dark:text-pink-400
                           border border-pink-500/25
                           hover:bg-pink-500/25 hover:border-pink-500/40
                           shadow-[0_0_15px_rgba(236,72,153,0.1)] hover:shadow-[0_0_25px_rgba(236,72,153,0.2)]
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                           hover:scale-105 active:scale-95
                           backdrop-blur-xl transition-all duration-300
                           flex items-center justify-center gap-2.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Schedule Start
              </button>
              {schedError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">{schedError}</p>
              )}
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2.5 text-center">
                Timer will automatically start at the scheduled time
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventSettingsScreen;
