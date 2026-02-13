import React, { useState } from 'react';
import type { Segment, SpeechColorAlert } from '../../types';
import { formatDuration } from '../../types';
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
  const [colorAlerts, setColorAlerts] = useState<SpeechColorAlert[]>(segment.colorAlerts);
  const [sound, setSound] = useState(segment.soundEnabled);
  const [tick, setTick] = useState(segment.tickEnabled ?? false);

  const handleSave = () => {
    onSave({
      name: name.trim() || 'Untitled',
      durationSeconds: hours * 3600 + minutes * 60 + seconds,
      mode,
      colorAlerts,
      soundEnabled: sound,
      flashEnabled: false,
      tickEnabled: tick,
    });
  };

  const addAlert = () => {
    setColorAlerts(prev => [...prev, {
      id: crypto.randomUUID(),
      timeInSeconds: 30,
      color: '#EF4444',
      background: true,
      flash: false,
      sound: false,
      label: '30 sec',
    }]);
  };

  const updateAlert = (id: string, updates: Partial<SpeechColorAlert>) => {
    setColorAlerts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAlert = (id: string) => {
    setColorAlerts(prev => prev.filter(a => a.id !== id));
  };

  const formatAlertTime = (totalSec: number): string => {
    if (totalSec >= 3600) return `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`;
    if (totalSec >= 60) return `${Math.floor(totalSec / 60)}m ${totalSec % 60 > 0 ? (totalSec % 60) + 's' : ''}`.trim();
    return `${totalSec}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/20 backdrop-blur-sm">
      <div className="
        w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh]
        bg-white/90 dark:bg-[#121212]/90
        backdrop-blur-2xl
        border-t sm:border border-white/20 dark:border-white/10
        rounded-t-[2.5rem] sm:rounded-[2.5rem]
        shadow-2xl overflow-hidden flex flex-col
        animate-slide-up
      ">
        {/* Header — iOS style text buttons */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-zinc-200/50 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-xl z-20">
          <button
            type="button"
            onClick={onClose}
            className="text-blue-500 font-medium text-[17px] hover:opacity-70 transition-opacity"
          >
            Cancel
          </button>
          <span className="text-zinc-900 dark:text-white font-semibold text-[17px]">Segment</span>
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
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Subtitle</h3>
            <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Speech name"
                  className="w-full bg-transparent text-[15px] font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* DURATION Section */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Duration</h3>
            <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
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
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'bg-white/15 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 border border-white/15 dark:border-white/10 hover:bg-white/25 dark:hover:bg-white/10'
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
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Count Mode</h3>
            <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex p-1 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-xl backdrop-blur-sm" role="tablist">
                  <button
                    type="button"
                    onClick={() => setMode('countdown')}
                    role="tab"
                    aria-selected={mode === 'countdown'}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                      mode === 'countdown'
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
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
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
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
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Audio</h3>
            <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between border-b border-zinc-200/50 dark:border-white/5">
                <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Alarm on Completion</span>
                <button
                  type="button"
                  onClick={() => setSound(!sound)}
                  aria-label="Alarm on Completion"
                  role="switch"
                  aria-checked={sound}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                    sound ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    sound ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Tick Sound</span>
                <button
                  type="button"
                  onClick={() => setTick(!tick)}
                  aria-label="Tick Sound"
                  role="switch"
                  aria-checked={tick}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                    tick ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    tick ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* COLOR ALERTS Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between px-4 mb-2">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color Alerts</h3>
              <button
                type="button"
                onClick={addAlert}
                aria-label="Add new color alert"
                className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase"
              >
                + Add
              </button>
            </div>
            <p className="px-4 mb-2 text-[10px] text-zinc-400 dark:text-zinc-500">
              {mode === 'countdown' ? 'Triggers at X seconds remaining' : 'Triggers at X seconds elapsed'}
            </p>

            <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
              {colorAlerts.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 dark:text-zinc-600 text-sm">
                  No visual alerts set.
                </div>
              ) : (
                [...colorAlerts].sort((a, b) => b.timeInSeconds - a.timeInSeconds).map((alert, idx) => (
                  <div key={alert.id} className={`p-4 ${idx !== colorAlerts.length - 1 ? 'border-b border-zinc-200/50 dark:border-white/5' : ''}`}>
                    {/* Row 1: MM:SS time + delete */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-baseline gap-1 text-zinc-900 dark:text-zinc-100">
                        <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">AT</span>
                        <input
                          type="number"
                          min={0}
                          max={1440}
                          value={Math.floor(alert.timeInSeconds / 60)}
                          onChange={e => {
                            const mins = parseInt(e.target.value) || 0;
                            const secs = alert.timeInSeconds % 60;
                            const total = mins * 60 + secs;
                            updateAlert(alert.id, { timeInSeconds: total, label: formatAlertTime(total) });
                          }}
                          onWheel={e => e.currentTarget.blur()}
                          className="w-8 bg-transparent text-right font-mono text-lg font-medium focus:text-blue-500 focus:outline-none"
                        />
                        <span className="text-xs text-zinc-400">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={(alert.timeInSeconds % 60).toString().padStart(2, '0')}
                          onChange={e => {
                            const mins = Math.floor(alert.timeInSeconds / 60);
                            const secs = Math.min(59, parseInt(e.target.value) || 0);
                            const total = mins * 60 + secs;
                            updateAlert(alert.id, { timeInSeconds: total, label: formatAlertTime(total) });
                          }}
                          onWheel={e => e.currentTarget.blur()}
                          className="w-8 bg-transparent font-mono text-lg font-medium focus:text-blue-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAlert(alert.id)}
                        aria-label="Delete this alert"
                        title="Delete alert"
                        className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    {/* Row 2: Color swatches + Sound toggle */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-2 items-center" aria-label="Alert color selection">
                        {['#EAB308', '#F97316', '#EF4444', '#22C55E', '#3B82F6', '#8B5CF6'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateAlert(alert.id, { color: c })}
                            className={`w-5 h-5 rounded-full transition-transform shadow-sm ${
                              alert.color === c ? 'scale-125 ring-2 ring-white dark:ring-zinc-600' : 'opacity-50 hover:opacity-100 hover:scale-110'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        {/* Custom color picker */}
                        <label
                          className="relative w-5 h-5 rounded-full cursor-pointer overflow-hidden ring-1 ring-zinc-300 dark:ring-zinc-600 hover:scale-110 transition-transform"
                          title="Custom color"
                          style={{ background: 'conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
                        >
                          <input
                            type="color"
                            value={alert.color}
                            onChange={e => updateAlert(alert.id, { color: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateAlert(alert.id, { sound: !alert.sound })}
                        title={alert.sound ? 'Sound enabled' : 'Sound disabled'}
                        className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                          alert.sound
                            ? 'bg-zinc-800 text-white dark:bg-white dark:text-black border-transparent'
                            : 'border-zinc-300 dark:border-zinc-700 text-zinc-400'
                        }`}
                      >
                        SOUND
                      </button>
                    </div>

                    {/* Row 3: Flash + Background toggles */}
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Flash</span>
                        <button
                          type="button"
                          onClick={() => updateAlert(alert.id, { flash: !alert.flash })}
                          aria-label="Toggle flash"
                          role="switch"
                          aria-checked={alert.flash}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                            alert.flash ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            alert.flash ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Background</span>
                        <button
                          type="button"
                          onClick={() => updateAlert(alert.id, { background: !alert.background })}
                          aria-label="Toggle persistent background"
                          role="switch"
                          aria-checked={alert.background}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
                            alert.background ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            alert.background ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SegmentSettingsScreen;
