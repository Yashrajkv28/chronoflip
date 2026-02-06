import React, { useState } from 'react';
import { TimerConfig, TimerMode, ColorAlert } from './FlipClockTimer';

interface TimerSettingsProps {
  config: TimerConfig;
  onSave: (config: TimerConfig) => void;
  onClose: () => void;
  onScheduleStart?: (scheduledTime: number) => void;
  clockModeOnly?: boolean; // When true, only show dark mode background settings
}

const TimerSettings: React.FC<TimerSettingsProps> = ({ config, onSave, onClose, onScheduleStart, clockModeOnly = false }) => {
  const [localConfig, setLocalConfig] = useState<TimerConfig>(config);
  const [hours, setHours] = useState(Math.floor(config.initialTimeInSeconds / 3600));
  const [minutes, setMinutes] = useState(Math.floor((config.initialTimeInSeconds % 3600) / 60));
  const [seconds, setSeconds] = useState(config.initialTimeInSeconds % 60);
  const [qaHours, setQaHours] = useState(Math.floor((config.qaTimeInSeconds || 0) / 3600));
  const [qaMinutes, setQaMinutes] = useState(Math.floor(((config.qaTimeInSeconds || 0) % 3600) / 60));
  const [qaSeconds, setQaSeconds] = useState((config.qaTimeInSeconds || 0) % 60);
  const [cuHours, setCuHours] = useState(Math.floor((config.countupLimitSeconds || 0) / 3600));
  const [cuMinutes, setCuMinutes] = useState(Math.floor(((config.countupLimitSeconds || 0) % 3600) / 60));
  const [cuSeconds, setCuSeconds] = useState((config.countupLimitSeconds || 0) % 60);

  // Scheduled start state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const handleModeChange = (mode: TimerMode) => {
    setLocalConfig(prev => ({ ...prev, mode }));
  };

  const handleSave = () => {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const qaTotalSeconds = qaHours * 3600 + qaMinutes * 60 + qaSeconds;
    const cuTotalSeconds = cuHours * 3600 + cuMinutes * 60 + cuSeconds;
    onSave({ ...localConfig, initialTimeInSeconds: totalSeconds, qaTimeInSeconds: qaTotalSeconds, countupLimitSeconds: cuTotalSeconds });
  };

  const handleScheduleStart = () => {
    if (!scheduleDate || !scheduleTime || !onScheduleStart) return;
    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const scheduledTimestamp = scheduledDateTime.getTime();

    if (scheduledTimestamp <= Date.now()) {
      // Time is in the past
      return;
    }

    // Save current config first, then schedule
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const qaTotalSeconds = qaHours * 3600 + qaMinutes * 60 + qaSeconds;
    const cuTotalSeconds = cuHours * 3600 + cuMinutes * 60 + cuSeconds;
    onSave({ ...localConfig, initialTimeInSeconds: totalSeconds, qaTimeInSeconds: qaTotalSeconds, countupLimitSeconds: cuTotalSeconds });
    onScheduleStart(scheduledTimestamp);
  };

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0];

  // Generic alert helpers that work for both colorAlerts and qaColorAlerts
  const addAlert = (key: 'colorAlerts' | 'qaColorAlerts') => {
    const newAlert: ColorAlert = {
      id: crypto.randomUUID(),
      timeInSeconds: 60,
      color: '#EAB308',
      flash: false,
      background: false,
      sound: true,
      label: 'New Alert',
    };
    setLocalConfig(prev => ({
      ...prev,
      [key]: [newAlert, ...prev[key]],
    }));
  };

  const removeAlert = (key: 'colorAlerts' | 'qaColorAlerts', id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: prev[key].filter((alert: ColorAlert) => alert.id !== id),
    }));
  };

  const updateAlert = (key: 'colorAlerts' | 'qaColorAlerts', id: string, updates: Partial<ColorAlert>) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: prev[key].map((alert: ColorAlert) =>
        alert.id === id ? { ...alert, ...updates } : alert
      ),
    }));
  };

  const colorOptions = [
    { value: '#22C55E', label: 'Green' },
    { value: '#EAB308', label: 'Yellow' },
    { value: '#F97316', label: 'Orange' },
    { value: '#EF4444', label: 'Red' },
    { value: '#3B82F6', label: 'Blue' },
    { value: '#A855F7', label: 'Purple' },
  ];

  /* --- iOS Style Components --- */

  const SegmentedControl = <T extends string>({
    options,
    value,
    onChange
  }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (val: T) => void;
  }) => (
    <div className="flex p-1 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-xl backdrop-blur-sm" role="tablist">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            role="tab"
            aria-selected={isActive}
            className={`
              flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300
              ${isActive
                ? 'bg-white dark:bg-zinc-600 text-black dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      aria-pressed={checked}
      className={`
        relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out focus:outline-none
        ${checked ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}
      `}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );

  const Section = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => (
    <div className={`mb-8 ${className}`}>
      {title && <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{title}</h3>}
      <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );

  const SectionItem = ({ children, border = true }: { children: React.ReactNode; border?: boolean }) => (
    <div className={`p-4 flex items-center justify-between ${border ? 'border-b border-zinc-200/50 dark:border-white/5' : ''}`}>
      {children}
    </div>
  );

  const AlertsSection = ({
    title, subtitle, timeLabel, alerts, alertKey, onAdd, onRemove, onUpdate, colorOptions: colors, ToggleSwitch: Toggle,
  }: {
    title: string;
    subtitle: string;
    timeLabel: string;
    alerts: ColorAlert[];
    alertKey: 'colorAlerts' | 'qaColorAlerts';
    onAdd: (key: 'colorAlerts' | 'qaColorAlerts') => void;
    onRemove: (key: 'colorAlerts' | 'qaColorAlerts', id: string) => void;
    onUpdate: (key: 'colorAlerts' | 'qaColorAlerts', id: string, updates: Partial<ColorAlert>) => void;
    colorOptions: { value: string; label: string }[];
    ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }>;
  }) => (
    <div className="mb-8">
      <div className="flex items-center justify-between px-4 mb-1">
        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{title}</h3>
        <button
          type="button"
          onClick={() => onAdd(alertKey)}
          aria-label="Add new color alert"
          className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase"
        >
          + Add
        </button>
      </div>
      <p className="px-4 mb-2 text-[10px] text-zinc-400 dark:text-zinc-500">{subtitle}</p>

      <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
        {alerts.length === 0 && (
          <div className="p-8 text-center text-zinc-400 dark:text-zinc-600 text-sm">
            No visual alerts set.
          </div>
        )}

        {alerts.map((alert, idx) => (
          <div key={alert.id} className={`p-4 ${idx !== alerts.length - 1 ? 'border-b border-zinc-200/50 dark:border-white/5' : ''}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-baseline gap-1 text-zinc-900 dark:text-zinc-100">
                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">{timeLabel}</span>
                <input
                  type="number"
                  value={Math.floor(alert.timeInSeconds / 60)}
                  onChange={(e) => onUpdate(alertKey, alert.id, { timeInSeconds: (parseInt(e.target.value) || 0) * 60 + (alert.timeInSeconds % 60) })}
                  onWheel={(e) => e.currentTarget.blur()}
                  aria-label="Alert time minutes"
                  className="w-8 bg-transparent text-right font-mono text-lg font-medium focus:text-blue-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-400">:</span>
                <input
                  type="number"
                  value={(alert.timeInSeconds % 60).toString().padStart(2, '0')}
                  onChange={(e) => onUpdate(alertKey, alert.id, { timeInSeconds: Math.floor(alert.timeInSeconds / 60) * 60 + (parseInt(e.target.value) || 0) })}
                  onWheel={(e) => e.currentTarget.blur()}
                  aria-label="Alert time seconds"
                  className="w-8 bg-transparent font-mono text-lg font-medium focus:text-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(alertKey, alert.id)}
                aria-label="Delete this alert"
                title="Delete alert"
                className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-red-500 hover:text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center" aria-label="Alert color selection">
                {colors.map((c) => {
                  const isSelected = alert.color === c.value;
                  return (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => onUpdate(alertKey, alert.id, { color: c.value })}
                      title={`${c.label}${isSelected ? ' (selected)' : ''}`}
                      aria-label={`Select ${c.label} color${isSelected ? ' (currently selected)' : ''}`}
                      className={`
                        w-5 h-5 rounded-full shadow-sm transition-transform
                        ${isSelected ? 'scale-125 ring-2 ring-white dark:ring-zinc-600' : 'opacity-50 hover:opacity-100 hover:scale-110'}
                      `}
                      style={{ backgroundColor: c.value }}
                    />
                  );
                })}
                <label
                  className="relative w-5 h-5 rounded-full cursor-pointer overflow-hidden ring-1 ring-zinc-300 dark:ring-zinc-600 hover:scale-110 transition-transform"
                  title="Pick custom color"
                  style={{
                    background: 'conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  }}
                >
                  <input
                    type="color"
                    value={alert.color}
                    onChange={(e) => onUpdate(alertKey, alert.id, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => onUpdate(alertKey, alert.id, { sound: !alert.sound })}
                title={alert.sound ? 'Sound enabled' : 'Sound disabled'}
                className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${alert.sound ? 'bg-zinc-800 text-white dark:bg-white dark:text-black border-transparent' : 'border-zinc-300 dark:border-zinc-700 text-zinc-400'}`}
              >
                SOUND
              </button>
            </div>

            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Flash</span>
                <Toggle checked={alert.flash} onChange={(v) => onUpdate(alertKey, alert.id, { flash: v })} label="Toggle flash" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Background</span>
                <Toggle checked={alert.background} onChange={(v) => onUpdate(alertKey, alert.id, { background: v })} label="Toggle persistent background" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/20 backdrop-blur-sm">
      {/* Modal Container */}
      <div 
        className="
          w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh]
          bg-white/90 dark:bg-[#121212]/90 
          backdrop-blur-2xl
          border-t sm:border border-white/20 dark:border-white/10
          rounded-t-[2.5rem] sm:rounded-[2.5rem]
          shadow-2xl overflow-hidden flex flex-col
          animate-slide-up
        "
      >
        {/* Navigation Bar */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-zinc-200/50 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-xl z-20">
          <button
            type="button"
            onClick={onClose}
            className="text-blue-500 font-medium text-[17px] hover:opacity-70 transition-opacity"
          >
            Cancel
          </button>
          <span className="text-zinc-900 dark:text-white font-semibold text-[17px]">{clockModeOnly ? 'Appearance' : 'Timer'}</span>
          <button
            type="button"
            onClick={handleSave}
            className="text-blue-500 font-bold text-[17px] hover:opacity-70 transition-opacity"
          >
            Done
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-hide">

          {!clockModeOnly && (<>
          {/* Mode Selector */}
          <div className="mb-8">
            <SegmentedControl
              options={[
                { value: 'countdown', label: 'Countdown' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'countup', label: 'Count Up' },
              ]}
              value={localConfig.mode}
              onChange={handleModeChange}
            />
            <div className="mt-2 px-2 text-xs text-zinc-400 dark:text-zinc-500 text-center">
              {localConfig.mode === 'hybrid' && ((qaHours + qaMinutes + qaSeconds) > 0
                ? "Presentation countdown → Q&A countdown → Complete"
                : "Counts down to zero, then starts counting up.")}
              {localConfig.mode === 'countup' && ((cuHours + cuMinutes + cuSeconds) > 0
                ? "Counts up to the set time, then completes."
                : "Counts up infinitely (stopwatch).")}
            </div>
          </div>

          {/* Time Picker */}
          {localConfig.mode !== 'countup' && (
            <>
              {localConfig.mode === 'hybrid' && (
                <div className="mb-2 text-center">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Presentation</span>
                </div>
              )}
              <div className="mb-4 flex justify-center items-center">
                <div className="flex items-baseline gap-1">
                  {[
                    { val: hours, set: setHours, label: 'h', ariaLabel: 'Hours' },
                    { val: minutes, set: setMinutes, label: 'm', ariaLabel: 'Minutes' },
                    { val: seconds, set: setSeconds, label: 's', ariaLabel: 'Seconds' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-baseline">
                      <input
                        type="number"
                        min="0"
                        max={i === 0 ? 99 : 59}
                        value={item.val.toString().padStart(2, '0')}
                        onChange={(e) => item.set(Math.min(i === 0 ? 99 : 59, parseInt(e.target.value) || 0))}
                        aria-label={item.ariaLabel}
                        className="
                          w-[2ch] bg-transparent p-0 text-center
                          text-6xl font-light tracking-tight
                          text-zinc-800 dark:text-white
                          focus:outline-none focus:text-blue-500
                          selection:bg-blue-500/20
                        "
                      />
                      <span className="text-xl font-medium text-zinc-400 dark:text-zinc-600 mr-2">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Count Up To - time picker (Count Up mode only) */}
          {localConfig.mode === 'countup' && (
            <div className="mb-8">
              <div className="mb-2 text-center">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Count Up To</span>
              </div>
              <div className="flex justify-center items-center">
                <div className="flex items-baseline gap-1">
                  {[
                    { val: cuHours, set: setCuHours, label: 'h', ariaLabel: 'Count Up Hours' },
                    { val: cuMinutes, set: setCuMinutes, label: 'm', ariaLabel: 'Count Up Minutes' },
                    { val: cuSeconds, set: setCuSeconds, label: 's', ariaLabel: 'Count Up Seconds' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-baseline">
                      <input
                        type="number"
                        min="0"
                        max={i === 0 ? 99 : 59}
                        value={item.val.toString().padStart(2, '0')}
                        onChange={(e) => item.set(Math.min(i === 0 ? 99 : 59, parseInt(e.target.value) || 0))}
                        aria-label={item.ariaLabel}
                        className="
                          w-[2ch] bg-transparent p-0 text-center
                          text-6xl font-light tracking-tight
                          text-zinc-800 dark:text-white
                          focus:outline-none focus:text-blue-500
                          selection:bg-blue-500/20
                        "
                      />
                      <span className="text-xl font-medium text-zinc-400 dark:text-zinc-600 mr-2">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 px-2 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                {(cuHours === 0 && cuMinutes === 0 && cuSeconds === 0)
                  ? "Set to 0 for unlimited stopwatch"
                  : ""}
              </div>
            </div>
          )}

          {/* Q&A Time Picker (Hybrid mode only) */}
          {localConfig.mode === 'hybrid' && (
            <div className="mb-8">
              <div className="mb-2 text-center">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Q&A</span>
              </div>
              <div className="flex justify-center items-center">
                <div className="flex items-baseline gap-1">
                  {[
                    { val: qaHours, set: setQaHours, label: 'h', ariaLabel: 'Q&A Hours' },
                    { val: qaMinutes, set: setQaMinutes, label: 'm', ariaLabel: 'Q&A Minutes' },
                    { val: qaSeconds, set: setQaSeconds, label: 's', ariaLabel: 'Q&A Seconds' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-baseline">
                      <input
                        type="number"
                        min="0"
                        max={i === 0 ? 99 : 59}
                        value={item.val.toString().padStart(2, '0')}
                        onChange={(e) => item.set(Math.min(i === 0 ? 99 : 59, parseInt(e.target.value) || 0))}
                        aria-label={item.ariaLabel}
                        className="
                          w-[2ch] bg-transparent p-0 text-center
                          text-6xl font-light tracking-tight
                          text-zinc-800 dark:text-white
                          focus:outline-none focus:text-blue-500
                          selection:bg-blue-500/20
                        "
                      />
                      <span className="text-xl font-medium text-zinc-400 dark:text-zinc-600 mr-2">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 px-2 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                {(qaHours === 0 && qaMinutes === 0 && qaSeconds === 0)
                  ? "Set to 0 for unlimited count-up"
                  : ""}
              </div>
            </div>
          )}

          {/* Settings Sections */}
          <Section title="DISPLAY">
            <SectionItem>
              <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Show Hours</span>
              <ToggleSwitch checked={localConfig.showHours} onChange={(v) => setLocalConfig(p => ({ ...p, showHours: v }))} label="Toggle show hours" />
            </SectionItem>
            <SectionItem border={false}>
              <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Show Days</span>
              <ToggleSwitch checked={localConfig.showDays} onChange={(v) => setLocalConfig(p => ({ ...p, showDays: v }))} label="Toggle show days" />
            </SectionItem>
          </Section>

          <Section title="AUDIO">
            <SectionItem>
              <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Tick Sound</span>
              <ToggleSwitch checked={localConfig.playTickSound} onChange={(v) => setLocalConfig(p => ({ ...p, playTickSound: v }))} label="Toggle tick sound" />
            </SectionItem>
            <SectionItem border={false}>
              <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Alert Sounds</span>
              <ToggleSwitch checked={localConfig.playAlertSound} onChange={(v) => setLocalConfig(p => ({ ...p, playAlertSound: v }))} label="Toggle alert sounds" />
            </SectionItem>
          </Section>

          {/* Delayed Start */}
          <Section title="DELAYED START">
            <SectionItem>
              <div className="flex flex-col">
                <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Start Delay</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Timer will start after this delay</span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={Math.floor((localConfig.delayedStartSeconds || 0) / 60)}
                  onChange={(e) => {
                    const mins = Math.min(59, parseInt(e.target.value) || 0);
                    const secs = (localConfig.delayedStartSeconds || 0) % 60;
                    setLocalConfig(p => ({ ...p, delayedStartSeconds: mins * 60 + secs }));
                  }}
                  aria-label="Delay minutes"
                  className="w-8 bg-transparent text-right font-mono text-lg font-medium text-zinc-800 dark:text-white focus:text-blue-500 focus:outline-none"
                />
                <span className="text-sm text-zinc-400">m</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={(localConfig.delayedStartSeconds || 0) % 60}
                  onChange={(e) => {
                    const mins = Math.floor((localConfig.delayedStartSeconds || 0) / 60);
                    const secs = Math.min(59, parseInt(e.target.value) || 0);
                    setLocalConfig(p => ({ ...p, delayedStartSeconds: mins * 60 + secs }));
                  }}
                  aria-label="Delay seconds"
                  className="w-8 bg-transparent text-right font-mono text-lg font-medium text-zinc-800 dark:text-white focus:text-blue-500 focus:outline-none"
                />
                <span className="text-sm text-zinc-400">s</span>
              </div>
            </SectionItem>
            <div className="px-4 pb-3 text-xs text-zinc-400 dark:text-zinc-500">
              Set to 0:00 to start immediately
            </div>
          </Section>

          {/* Scheduled Start */}
          {onScheduleStart && (
            <Section title="SCHEDULED START">
              <SectionItem>
                <div className="flex flex-col flex-1">
                  <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100 mb-2">Start at specific time</span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={today}
                      aria-label="Schedule date"
                      className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      aria-label="Schedule time"
                      className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </SectionItem>
              <div className="px-4 pb-3">
                <button
                  type="button"
                  onClick={handleScheduleStart}
                  disabled={!scheduleDate || !scheduleTime}
                  className="w-full py-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-600 dark:text-pink-400 font-bold border border-pink-500/30 hover:border-pink-500/50 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Schedule Start</span>
                  </div>
                </button>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                  Timer will automatically start at the scheduled time
                </p>
              </div>
            </Section>
          )}

          {/* Color Alerts - Only for Countdown/Hybrid */}
          {localConfig.mode !== 'countup' && (
            <AlertsSection
              title={localConfig.mode === 'hybrid' ? 'PRESENTATION ALERTS' : 'COLOR ALERTS'}
              subtitle={localConfig.mode === 'hybrid' ? 'Triggered by remaining countdown time' : 'Only active in Countdown and Hybrid modes'}
              timeLabel="AT"
              alerts={localConfig.colorAlerts}
              alertKey="colorAlerts"
              onAdd={addAlert}
              onRemove={removeAlert}
              onUpdate={updateAlert}
              colorOptions={colorOptions}
              ToggleSwitch={ToggleSwitch}
            />
          )}

          {/* Q&A Alerts - Hybrid mode only */}
          {localConfig.mode === 'hybrid' && (
            <AlertsSection
              title="Q&A ALERTS"
              subtitle="Triggered by elapsed count-up time"
              timeLabel="AT"
              alerts={localConfig.qaColorAlerts}
              alertKey="qaColorAlerts"
              onAdd={addAlert}
              onRemove={removeAlert}
              onUpdate={updateAlert}
              colorOptions={colorOptions}
              ToggleSwitch={ToggleSwitch}
            />
          )}
          </>)}

          {/* Dark Mode Background Orbs */}
          <div className="mb-8">
            <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              DARK MODE BACKGROUND
            </h3>
            <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
              {([
                { label: 'Orb 1 — Top Left', idx: 0 },
                { label: 'Orb 2 — Center', idx: 2 },
                { label: 'Orb 3 — Bottom Right', idx: 1 },
              ] as const).map(({ label, idx: i }, displayIdx) => (
                <div key={i} className={`p-4 ${displayIdx < 2 ? 'border-b border-zinc-200/50 dark:border-white/5' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[15px] text-zinc-700 dark:text-zinc-200">{label}</span>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl border-2 border-zinc-200 dark:border-zinc-600 shadow-sm"
                        style={{ backgroundColor: localConfig.orbColors[i] }}
                      />
                      <label className="relative w-8 h-8 rounded-xl cursor-pointer overflow-hidden ring-1 ring-zinc-300 dark:ring-zinc-600 hover:scale-110 transition-transform"
                        style={{
                          background: 'conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        }}
                      >
                        <input
                          type="color"
                          value={localConfig.orbColors[i]}
                          onChange={(e) => {
                            const newOrbs = [...localConfig.orbColors] as [string, string, string];
                            newOrbs[i] = e.target.value;
                            setLocalConfig(prev => ({ ...prev, orbColors: newOrbs }));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 w-14 shrink-0">Intensity</span>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={localConfig.orbOpacities?.[i] ?? [30, 25, 25][i]}
                      onChange={(e) => {
                        const newOpacities = [...(localConfig.orbOpacities || [30, 25, 25])] as [number, number, number];
                        newOpacities[i] = parseInt(e.target.value);
                        setLocalConfig(prev => ({ ...prev, orbOpacities: newOpacities }));
                      }}
                      className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 cursor-pointer accent-blue-500"
                    />
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 w-8 text-right">{localConfig.orbOpacities?.[i] ?? [30, 25, 25][i]}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 mt-2">
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Customize the gradient orbs visible in dark mode
              </p>
              <button
                type="button"
                onClick={() => setLocalConfig(prev => ({
                  ...prev,
                  orbColors: ['#A855F7', '#3B82F6', '#6366F1'],
                  orbOpacities: [30, 25, 25],
                }))}
                className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase"
              >
                Reset
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TimerSettings;