import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpeechEvent } from '../../types';
import { useSwipeToDelete } from '../../hooks/useSwipeToDelete';

interface EventCardProps {
  event: SpeechEvent;
  editMode: boolean;
  onSelect: () => void;
  onStart: () => void;
  onDelete: () => void;
  swipeOpenId?: string | null;
  onSwipeOpen?: (id: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, editMode, onSelect, onStart, onDelete, swipeOpenId, onSwipeOpen }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id, disabled: !editMode });

  const {
    handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel,
    offsetX, isOpen, isTracking, deleteZoneProps,
  } = useSwipeToDelete({
    onDelete,
    disabled: isDragging,
    openId: swipeOpenId,
    id: event.id,
    onOpen: onSwipeOpen,
  });

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const contentStyle: React.CSSProperties = {
    transform: `translateX(${offsetX}px)`,
    transition: isTracking ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  };

  const totalDuration = event.segments.reduce((sum, s) => sum + s.durationSeconds, 0);
  const segmentCount = event.segments.length;

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className="group relative rounded-2xl overflow-hidden"
    >
      {/* Delete zone - behind the sliding content, hidden until swiped */}
      <div
        className="absolute inset-y-0 right-0 w-20 flex items-center justify-center
                   bg-red-500 text-white cursor-pointer
                   hover:bg-red-600 transition-all duration-200"
        style={{ opacity: offsetX < 0 ? 1 : 0 }}
        role="button"
        aria-label="Delete event"
        {...deleteZoneProps}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2"
             stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </div>

      {/* Sliding content wrapper */}
      <div
        style={contentStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative
                   bg-white/25 dark:bg-white/5
                   backdrop-blur-xl
                   border border-white/30 dark:border-white/10
                   shadow-[0_4px_16px_rgba(0,0,0,0.06)]
                   dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]
                   hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)]
                   dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                   hover:bg-white/35 dark:hover:bg-white/8
                   transition-[background-color,box-shadow] duration-300
                   rounded-2xl"
      >
        <div className="flex items-center gap-3 p-4 sm:p-5">
          {/* Drag handle */}
          {editMode && (
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing p-1 text-zinc-400 dark:text-zinc-500 touch-none"
              {...attributes}
              {...listeners}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
          )}

          {/* Content - clickable */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={isOpen ? undefined : onSelect}>
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 truncate text-base sm:text-lg">
              {event.title}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{segmentCount} segment{segmentCount !== 1 ? 's' : ''}</span>
              {totalDuration > 0 && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                  <span>
                    {totalDuration >= 3600
                      ? `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`
                      : `${Math.floor(totalDuration / 60)}m${totalDuration % 60 > 0 ? ` ${totalDuration % 60}s` : ''}`}
                  </span>
                </>
              )}
              {event.scheduledStartTime != null && event.scheduledStartTime > 0 && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                  <span className="text-pink-500 dark:text-pink-400">
                    {new Date(event.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {editMode ? (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
                aria-label="Delete event"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStart(); }}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider
                           bg-emerald-500/15 text-emerald-600 dark:text-emerald-400
                           border border-emerald-500/20
                           hover:bg-emerald-500/25 hover:border-emerald-500/40
                           hover:scale-105 active:scale-95
                           transition-all duration-200"
              >
                START
              </button>
            )}
          </div>
        </div>

        {/* Color strip from segments at bottom */}
        {event.segments.length > 0 && (
          <div className="flex h-1 overflow-hidden">
            {event.segments.map(seg => (
              <div
                key={seg.id}
                className="flex-1"
                style={{ backgroundColor: seg.colorAlerts?.[0]?.color ?? '#3B82F6' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(EventCard);
