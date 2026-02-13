import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Segment } from '../../types';
import { formatDurationString } from '../../types';
import { useSwipeToDelete } from '../../hooks/useSwipeToDelete';

interface SegmentCardProps {
  segment: Segment;
  editMode: boolean;
  onEdit: () => void;
  onStart: () => void;
  onDelete: () => void;
  swipeOpenId?: string | null;
  onSwipeOpen?: (id: string) => void;
}

const SegmentCard: React.FC<SegmentCardProps> = ({ segment, editMode, onEdit, onStart, onDelete, swipeOpenId, onSwipeOpen }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.id, disabled: !editMode });

  const {
    handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel,
    offsetX, isOpen, isTracking, deleteZoneProps,
  } = useSwipeToDelete({
    onDelete,
    disabled: isDragging,
    openId: swipeOpenId,
    id: segment.id,
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

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className="group relative rounded-xl overflow-hidden"
    >
      {/* Delete zone - behind the sliding content, hidden until swiped */}
      <div
        className="absolute inset-y-0 right-0 w-20 flex items-center justify-center
                   bg-red-500 text-white cursor-pointer
                   hover:bg-red-600 transition-all duration-200"
        style={{ opacity: offsetX < 0 ? 1 : 0 }}
        role="button"
        aria-label="Delete segment"
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
                   bg-white/20 dark:bg-white/5
                   backdrop-blur-xl
                   border border-white/25 dark:border-white/10
                   shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                   dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]
                   hover:bg-white/30 dark:hover:bg-white/8
                   transition-[background-color] duration-200
                   rounded-xl"
      >
        {/* Left color strip */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: segment.colorAlerts[0]?.color ?? '#3B82F6' }}
        />

        <div className="flex items-center gap-3 pl-5 pr-4 py-3 sm:py-4">
          {/* Drag handle */}
          {editMode && (
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing p-1 text-zinc-400 dark:text-zinc-500 touch-none"
              {...attributes}
              {...listeners}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
          )}

          {/* Content - clickable */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={isOpen ? undefined : onEdit}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 truncate">
                {segment.name}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                segment.mode === 'countdown'
                  ? 'bg-red-500/15 text-red-500 dark:text-red-400'
                  : 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
              }`}>
                {segment.mode === 'countdown' ? 'CountDown' : 'CountUp'}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-mono text-zinc-500 dark:text-zinc-400">
              {formatDurationString(segment.durationSeconds)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {editMode ? (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
                aria-label="Delete segment"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStart(); }}
                className="p-1.5 rounded-lg text-emerald-500 dark:text-emerald-400
                           hover:bg-emerald-500/10 hover:scale-110 active:scale-95
                           transition-all duration-200"
                aria-label="Start from this segment"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SegmentCard);
