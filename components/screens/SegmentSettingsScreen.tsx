import React, { useState } from 'react';
import type { Segment } from '../../types';
import { formatDuration, SEGMENT_COLORS } from '../../types';
import ScrollWheelPicker from '../ui/ScrollWheelPicker';

interface SegmentSettingsScreenProps {
  segment: Segment;
  onSave: (updates: Partial<Segment>) => void;
  onClose: () => void;
}

const SegmentSettingsScreen: React.FC<SegmentSettingsScreenProps> = ({ segment, onSave, onClose }) => {
  const { h, m, s } = formatDuration(segment.durationSeconds);
  const [name, setName] = useState(segment.name);
  const [hours, setHours] = useState(h);
  const [minutes, setMinutes] = useState(m);
  const [seconds, setSeconds] = useState(s);
  const [mode, setMode] = useState(segment.mode);
  const [color, setColor] = useState(segment.color);
  const [sound, setSound] = useState(segment.soundEnabled);
  const [flash, setFlash] = useState(segment.flashEnabled ?? false);
  const [tick, setTick] = useState(segment.tickEnabled ?? false);

  const handleSave = () => {
    onSave({
      name: name.trim() || 'Untitled',
      durationSeconds: hours * 3600 + minutes * 60 + seconds,
      mode,
      color,
      soundEnabled: sound,
      flashEnabled: flash,
      tickEnabled: tick,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/20 backdrop-blur-sm">
      <div className="
        w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh]
        bg-white/90
        backdrop-blur-2xl
        border-t sm:border border-white/20
        rounded-t-[2.5rem] sm:rounded-[2.5rem]
        shadow-2xl overflow-hidden flex flex-col
        animate-slide-up
      ">
        {/* Header — iOS style text buttons */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-zinc-200/50 bg-white/50 backdrop-blur-xl z-20">
          <button
            type="button"
            onClick={onClose}
            className="text-blue-500 font-medium text-[17px] hover:opacity-70 transition-opacity"
          >
            Cancel
          </button>
          <span className="text-zinc-900 font-semibold text-[17px]">Segment</span>
          <button
            type="button"
            onClick={handleSave}
            className="text-blue-500 font-bold text-[17px] hover:opacity-70 transition-opacity"
          >
            Done
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-24 sm:pb-6">

          {/* SUBTITLE Section */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Subtitle</h3>
            <div className="bg-zinc-50/80 backdrop-blur-md border border-zinc-200/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Speech name"
                  className="w-full bg-transparent text-[15px] font-medium text-zinc-900 placeholder-zinc-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* DURATION Section */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Duration</h3>
            <div className="bg-zinc-50/80 backdrop-blur-md border border-zinc-200/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-center gap-4 sm:gap-8">
                  <ScrollWheelPicker value={hours} min={0} max={23} onChange={setHours} label="hours" />
                  <ScrollWheelPicker value={minutes} min={0} max={59} onChange={setMinutes} label="min" />
                  <ScrollWheelPicker value={seconds} min={0} max={59} onChange={setSeconds} label="sec" />
                </div>

                {/* Preset buttons */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-4 justify-center">
                  {[
                    { label: '5m', sec: 300 },
                    { label: '10m', sec: 600 },
                    { label: '15m', sec: 900 },
                    { label: '20m', sec: 1200 },
                    { label: '30m', sec: 1800 },
                    { label: '45m', sec: 2700 },
                    { label: '60m', sec: 3600 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        const h2 = Math.floor(p.sec / 3600);
                        const m2 = Math.floor((p.sec % 3600) / 60);
                        const s2 = p.sec % 60;
                        setHours(h2); setMinutes(m2); setSeconds(s2);
                      }}
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200
                        ${hours * 3600 + minutes * 60 + seconds === p.sec
                          ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30'
                          : 'bg-white/15 text-zinc-500 border border-white/15 hover:bg-white/25'
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* COUNT MODE Section — SegmentedControl style */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Count Mode</h3>
            <div className="bg-zinc-50/80 backdrop-blur-md border border-zinc-200/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex p-1 bg-zinc-200/80 rounded-xl backdrop-blur-sm" role="tablist">
                  <button
                    type="button"
                    onClick={() => setMode('countdown')}
                    role="tab"
                    aria-selected={mode === 'countdown'}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                      mode === 'countdown'
                        ? 'bg-red-500/20 text-red-600 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Countdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('countup')}
                    role="tab"
                    aria-selected={mode === 'countup'}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                      mode === 'countup'
                        ? 'bg-blue-500/20 text-blue-600 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Count Up
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AUDIO Section */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Audio</h3>
            <div className="bg-zinc-50/80 backdrop-blur-md border border-zinc-200/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between border-b border-zinc-200/50">
                <span className="text-[15px] font-medium text-zinc-900">Alarm on Completion</span>
                <button
                  type="button"
                  onClick={() => setSound(!sound)}
                  aria-label="Alarm on Completion"
                  role="switch"
                  aria-checked={sound}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                    sound ? 'bg-blue-500' : 'bg-zinc-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    sound ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <div className="p-4 flex items-center justify-between border-b border-zinc-200/50">
                <span className="text-[15px] font-medium text-zinc-900">Tick Sound</span>
                <button
                  type="button"
                  onClick={() => setTick(!tick)}
                  aria-label="Tick Sound"
                  role="switch"
                  aria-checked={tick}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                    tick ? 'bg-blue-500' : 'bg-zinc-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    tick ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-[15px] font-medium text-zinc-900">Flash on Completion</span>
                <button
                  type="button"
                  onClick={() => setFlash(!flash)}
                  aria-label="Flash on Completion"
                  role="switch"
                  aria-checked={flash}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                    flash ? 'bg-blue-500' : 'bg-zinc-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    flash ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* SEGMENT COLOR Section */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Segment Color</h3>
            <p className="px-4 mb-3 text-[10px] text-zinc-400">
              Background color while this segment is active
            </p>
            <div className="bg-zinc-50/80 backdrop-blur-md border border-zinc-200/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                {/* Color preview bar */}
                <div
                  className="w-full h-10 rounded-xl mb-4 shadow-inner border border-black/5"
                  style={{ backgroundColor: color }}
                />
                {/* Color swatches */}
                <div className="flex flex-wrap gap-3 justify-center">
                  {SEGMENT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${
                        color === c
                          ? 'border-zinc-800 scale-110 shadow-lg'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                  {/* Custom color picker */}
                  <label
                    className="relative w-8 h-8 rounded-full cursor-pointer overflow-hidden ring-1 ring-zinc-300 hover:scale-110 transition-transform"
                    title="Custom color"
                    style={{ background: 'conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SegmentSettingsScreen;
