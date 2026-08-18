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
}

const EventListScreen: React.FC<EventListScreenProps> = ({
  events,
  onAddEvent,
  onSelectEvent,
  onStartEvent,
  onDeleteEvent,
  onReorderEvents,
  onShowHelp,
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
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 relative">
        <div className="max-w-2xl mx-auto">
          {/* Row 1: Speech Timer badge centered */}
          <div className="flex items-center justify-center mb-3">
            <span className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] border bg-white border-border-soft text-text-secondary shadow-hard-sm">
              Speech Timer
            </span>
          </div>

          {/* Row 2: Edit + Add buttons centered */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold border shadow-hard-sm hover:shadow-hard hover:scale-105 active:scale-95 transition-all duration-300 ${
                editMode
                  ? 'bg-accent-blue text-white border-accent-blue'
                  : 'bg-white text-text-primary border-border-soft hover:bg-bg-secondary'
              }`}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={onAddEvent}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold
                         bg-white
                         border border-border-soft
                         text-text-primary
                         hover:bg-bg-secondary
                         hover:scale-105 active:scale-95
                         transition-all duration-200 shadow-hard-sm hover:shadow-hard
                         flex items-center gap-1.5"
              aria-label="Add new event"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
              New Event
            </button>
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4 text-text-muted opacity-60">+</div>
              <p className="text-text-secondary text-sm">
                No events yet. Tap + New Event to create one.
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
