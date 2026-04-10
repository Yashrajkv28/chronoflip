import React, { useState } from 'react';
import type { Segment, TimerGroup } from '../../types';
import SegmentCard from './SegmentCard';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface GroupBlockProps {
  group: TimerGroup;
  segments: Segment[];
  editMode: boolean;
  onEditGroup: (updates: Partial<TimerGroup>) => void;
  onDeleteGroup: () => void;
  onStartGroup: () => void;
  onAddSegmentToGroup: () => void;
  onEditSegment: (segmentId: string) => void;
  onDeleteSegment: (segmentId: string) => void;
  onStartSegment: (segmentId: string) => void;
  onReorderSegments: (activeId: string, overId: string) => void;
  swipeOpenId: string | null;
  onSwipeOpen: (id: string) => void;
}

const GroupBlock: React.FC<GroupBlockProps> = ({
  group,
  segments,
  editMode,
  onEditGroup,
  onDeleteGroup,
  onStartGroup,
  onAddSegmentToGroup,
  onEditSegment,
  onDeleteSegment,
  onStartSegment,
  onReorderSegments,
  swipeOpenId,
  onSwipeOpen,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);

  const handleNameSave = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== group.name) {
      onEditGroup({ name: trimmed });
    }
    setEditingName(false);
  };

  const totalDuration = segments.reduce((sum, s) => sum + s.durationSeconds, 0);

  return (
    <div className="rounded-2xl border-2 border-violet-500/20 bg-violet-500/5 overflow-hidden">
      {/* Group Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-violet-500/10">
        {editMode && (
          <button
            type="button"
            onClick={onDeleteGroup}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
            aria-label="Delete group"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={e => e.key === 'Enter' && handleNameSave()}
              autoFocus
              className="w-full text-sm font-bold bg-transparent border-b-2 border-violet-500/50 text-violet-700 outline-none py-0.5"
            />
          ) : (
            <div
              onClick={() => { setNameValue(group.name); setEditingName(true); }}
              className="cursor-pointer hover:opacity-70 transition-opacity"
            >
              <h3 className="text-sm font-bold text-violet-700 truncate">{group.name}</h3>
              <span className="text-[10px] text-violet-400">
                {segments.length} timer{segments.length !== 1 ? 's' : ''}
                {totalDuration > 0 && ` \u00B7 ${Math.floor(totalDuration / 60)}m`}
              </span>
            </div>
          )}
        </div>

        {!editMode && (
          <button
            type="button"
            onClick={onStartGroup}
            className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider
                       bg-emerald-500/15 text-emerald-600
                       border border-emerald-500/20
                       hover:bg-emerald-500/25 hover:border-emerald-500/40
                       hover:scale-105 active:scale-95
                       transition-all duration-200"
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              START
            </div>
          </button>
        )}
      </div>

      {/* Group Segments */}
      <div className="px-3 py-2 space-y-1.5">
        <SortableContext
          items={segments.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {segments.map(segment => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              editMode={editMode}
              onEdit={() => onEditSegment(segment.id)}
              onStart={() => onStartSegment(segment.id)}
              onDelete={() => onDeleteSegment(segment.id)}
              swipeOpenId={swipeOpenId}
              onSwipeOpen={onSwipeOpen}
            />
          ))}
        </SortableContext>

        {/* Add timer to group */}
        <button
          type="button"
          onClick={onAddSegmentToGroup}
          className="w-full py-2 rounded-xl text-xs font-medium text-violet-500
                     border border-dashed border-violet-500/30
                     hover:bg-violet-500/10 hover:border-violet-500/50
                     transition-all duration-200
                     flex items-center justify-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          New Timer
        </button>
      </div>
    </div>
  );
};

export default GroupBlock;
