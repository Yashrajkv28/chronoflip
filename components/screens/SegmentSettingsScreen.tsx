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

  // Toggle switch component
  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-label={label}
        role="switch"
        aria-checked={value}
        className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
          value ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
          value ? 'left-[22px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full md:max-w-md md:mx-4 max-h-[90dvh] overflow-y-auto
                      rounded-t-3xl md:rounded-3xl
                      bg-white/80 dark:bg-zinc-900/90
                      backdrop-blur-2xl
                      border border-white/30 dark:border-white/10
                      shadow-[0_-8px_32px_rgba(0,0,0,0.15)]
                      dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)]
                      animate-slide-up">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4
                        bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl
                        border-b border-white/20 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Segment Settings</span>
          <button
            type="button"
            onClick={handleSave}
            className="p-1 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Subtitle
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Speech name"
              className="w-full px-4 py-3 rounded-xl
                         bg-white/50 dark:bg-white/5
                         border border-white/30 dark:border-white/10
                         text-zinc-800 dark:text-white
                         placeholder-zinc-400 dark:placeholder-zinc-600
                         outline-none focus:border-blue-500/50
                         transition-all"
            />
          </div>

          {/* Time Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
              Duration
            </label>
            <div className="flex items-start justify-center gap-4 sm:gap-8
                            p-4 rounded-2xl
                            bg-zinc-100/50 dark:bg-zinc-800/50
                            border border-white/20 dark:border-white/5">
              <ScrollWheelPicker value={hours} min={0} max={23} onChange={setHours} label="hours" />
              <ScrollWheelPicker value={minutes} min={0} max={59} onChange={setMinutes} label="min" />
              <ScrollWheelPicker value={seconds} min={0} max={59} onChange={setSeconds} label="sec" />
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 justify-center">
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

          {/* Count Mode */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Count function
            </label>
            <div className="flex rounded-xl overflow-hidden border border-white/20 dark:border-white/10">
              <button
                type="button"
                onClick={() => setMode('countdown')}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  mode === 'countdown'
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-white/10 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:bg-white/20 dark:hover:bg-white/10'
                }`}
              >
                CountDown
              </button>
              <button
                type="button"
                onClick={() => setMode('countup')}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  mode === 'countup'
                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    : 'bg-white/10 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:bg-white/20 dark:hover:bg-white/10'
                }`}
              >
                CountUp
              </button>
            </div>
          </div>

          {/* Color Alerts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Color Alerts
              </label>
              <button
                type="button"
                onClick={addAlert}
                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-all"
                aria-label="Add color alert"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round">
                  <path d="M12 5v14m-7-7h14" />
                </svg>
              </button>
            </div>

            {colorAlerts.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
                No alerts. Tap + to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {[...colorAlerts].sort((a, b) => b.timeInSeconds - a.timeInSeconds).map(alert => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl
                               bg-white/20 dark:bg-white/5
                               border border-white/20 dark:border-white/10"
                  >
                    {/* Row 1: MM:SS time + delete */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">
                          {mode === 'countdown' ? 'at' : 'at'}
                        </span>
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
                          className="w-8 bg-transparent text-right font-mono text-lg font-medium text-zinc-800 dark:text-zinc-100 focus:text-blue-500 focus:outline-none"
                        />
                        <span className="text-sm text-zinc-400">:</span>
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
                          className="w-8 bg-transparent font-mono text-lg font-medium text-zinc-800 dark:text-zinc-100 focus:text-blue-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAlert(alert.id)}
                        className="ml-auto w-7 h-7 flex items-center justify-center rounded-full
                                   text-zinc-400 dark:text-zinc-500
                                   hover:bg-red-500/15 hover:text-red-500
                                   transition-all duration-200"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Row 2: Color swatches + Sound toggle */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-2 items-center">
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
                        className={`text-[10px] font-bold px-2.5 py-1 rounded border transition-colors ${
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
                          aria-label="Flash"
                          role="switch"
                          aria-checked={alert.flash}
                          className={`relative w-10 h-6 rounded-full transition-all duration-300 ${
                            alert.flash ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
                            alert.flash ? 'left-[18px]' : 'left-0.5'
                          }`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Background</span>
                        <button
                          type="button"
                          onClick={() => updateAlert(alert.id, { background: !alert.background })}
                          aria-label="Background"
                          role="switch"
                          aria-checked={alert.background}
                          className={`relative w-10 h-6 rounded-full transition-all duration-300 ${
                            alert.background ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
                            alert.background ? 'left-[18px]' : 'left-0.5'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
              {mode === 'countdown' ? 'Triggers at X seconds remaining' : 'Triggers at X seconds elapsed'}
            </p>
          </div>

          {/* Audio Toggles */}
          <div className="space-y-4">
            <Toggle value={sound} onChange={setSound} label="Alarm on Completion" />
            <Toggle value={tick} onChange={setTick} label="Tick Sound" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentSettingsScreen;
