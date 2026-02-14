import React, { useRef, useEffect, useCallback } from 'react';

interface ScrollWheelPickerProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

const ScrollWheelPicker: React.FC<ScrollWheelPickerProps> = ({ value, min, max, onChange, label }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Flag to ignore onScroll events caused by the wheel handler setting scrollTop
  const wheelScrollingRef = useRef(false);

  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const spacerHeight = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

  // Sync scroll position when value changes from parent (presets, etc.)
  useEffect(() => {
    if (containerRef.current && !isUserScrolling.current) {
      containerRef.current.scrollTop = (value - min) * ITEM_HEIGHT;
    }
  }, [value, min]);

  // Mouse wheel: move exactly one item per notch, sync scroll position immediately
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 50) return; // trackpad: let native scroll handle it
      e.preventDefault();

      const current = valueRef.current;
      const direction = Math.sign(e.deltaY);
      const newValue = Math.max(min, Math.min(max, current + direction));
      if (newValue !== current) {
        valueRef.current = newValue;
        // Sync scroll position immediately so visual matches value
        wheelScrollingRef.current = true;
        el.scrollTop = (newValue - min) * ITEM_HEIGHT;
        requestAnimationFrame(() => { wheelScrollingRef.current = false; });
        onChange(newValue);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [min, max, onChange]);

  // Handle native scroll (touch/trackpad) — ignored for wheel-driven scrolls
  const handleScroll = useCallback(() => {
    if (wheelScrollingRef.current) return;
    isUserScrolling.current = true;

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = window.setTimeout(() => {
      if (containerRef.current) {
        const index = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
        const newValue = min + clampedIndex;

        // Snap to position
        containerRef.current.scrollTo({
          top: clampedIndex * ITEM_HEIGHT,
          behavior: 'smooth',
        });

        if (newValue !== valueRef.current) {
          onChange(newValue);
        }
      }
      isUserScrolling.current = false;
    }, 100);
  }, [min, values.length, onChange]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-scroll overflow-x-hidden snap-y snap-mandatory no-scrollbar"
          style={{
            height: ITEM_HEIGHT * VISIBLE_ITEMS,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          } as React.CSSProperties}
        >
          {/* Top spacer */}
          <div style={{ height: spacerHeight }} />
          {values.map(v => (
            <div
              key={v}
              className="snap-center flex items-center justify-center"
              style={{ height: ITEM_HEIGHT }}
            >
              <span className={`text-2xl sm:text-3xl font-mono transition-all duration-150 ${
                v === value
                  ? 'text-zinc-900 dark:text-white font-bold scale-110'
                  : 'text-zinc-400 dark:text-zinc-600'
              }`}>
                {v.toString().padStart(2, '0')}
              </span>
            </div>
          ))}
          {/* Bottom spacer */}
          <div style={{ height: spacerHeight }} />
        </div>

        {/* Selection highlight */}
        <div
          className="absolute pointer-events-none left-0 right-0 border-t-2 border-b-2 border-blue-500/40 dark:border-blue-400/40"
          style={{
            top: spacerHeight,
            height: ITEM_HEIGHT,
          }}
        />
      </div>
      {label && (
        <span className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  );
};

export default React.memo(ScrollWheelPicker);
