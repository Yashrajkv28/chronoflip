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
import EventCard from '../ui/EventCard';

interface EventListScreenProps {
  events: SpeechEvent[];
  onAddEvent: () => void;
  onSelectEvent: (eventId: string) => void;
  onStartEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onReorderEvents: (activeId: string, overId: string) => void;
  onShowHelp: () => void;
  onSwitchMode: () => void;
}

const EventListScreen: React.FC<EventListScreenProps> = ({
  events,
  onAddEvent,
  onSelectEvent,
  onStartEvent,
  onDeleteEvent,
  onReorderEvents,
  onShowHelp,
  onSwitchMode,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderEvents(active.id as string, over.id as string);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 relative">
        {/* Clock button - absolute top-left */}
        <button
          type="button"
          onClick={() => onSwitchMode()}
          className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-4 sm:left-6 z-10 flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/20 dark:bg-white/5 backdrop-blur-xl border border-white/30 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-white/30 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
          title="Switch to Clock Mode (C)"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
          </svg>
          <span className="text-xs sm:text-sm font-semibold tracking-wide">Clock</span>
        </button>

        <div className="max-w-2xl mx-auto">
          {/* Row 1: Speech Timer badge centered */}
          <div className="flex items-center justify-center mb-3">
            <span className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] border bg-purple-500/10 border-purple-500/20 text-purple-500 dark:bg-purple-400/10 dark:border-purple-400/20 dark:text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)] dark:shadow-[0_0_20px_rgba(192,132,252,0.2)]">
              Speech Timer
            </span>
          </div>

          {/* Row 2: Edit + Add buttons centered */}
          <div className="flex items-center justify-center gap-3">
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
            <button
              type="button"
              onClick={onAddEvent}
              className="p-2.5 rounded-xl
                         bg-white/20 dark:bg-white/5 backdrop-blur-md
                         border border-white/30 dark:border-white/10
                         text-zinc-600 dark:text-zinc-300
                         hover:bg-white/30 dark:hover:bg-white/10
                         hover:scale-110 active:scale-95
                         transition-all duration-200 shadow-md"
              aria-label="Add new event"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4 opacity-30">+</div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                No events yet. Tap + to create one.
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={events.map(e => e.id)} strategy={verticalListSortingStrategy}>
                {events.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    editMode={editMode}
                    onSelect={() => onSelectEvent(event.id)}
                    onStart={() => onStartEvent(event.id)}
                    onDelete={() => onDeleteEvent(event.id)}
                    swipeOpenId={swipeOpenId}
                    onSwipeOpen={setSwipeOpenId}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventListScreen;
