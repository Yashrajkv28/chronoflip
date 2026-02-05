import React, { useEffect, useState, useRef } from 'react';

interface FlipDigitProps {
  value: string;
  label?: string;
  colorClass?: string;
}

const FlipDigit: React.FC<FlipDigitProps> = ({ value, label, colorClass = '' }) => {
  // Use ref to track the previous value (doesn't cause re-renders)
  const prevValueRef = useRef<string>(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0); // Force re-mount of animated elements
  
  // Current display values
  const currentValue = value;
  
  // CRITICAL: This allows us to read the latest ref value during render cycles
  const previousValue = prevValueRef.current;

  // Detect if we are in the 'pre-animation' frame where props changed but effect hasn't run
  const isValueMismatch = value !== prevValueRef.current;

  useEffect(() => {
    // Only animate if value actually changed
    if (value !== prevValueRef.current) {
      // Trigger new animation
      setIsFlipping(true);
      setFlipKey(prev => prev + 1); // Force fresh animation

      // Animation duration: 0.3s (top) + 0.3s (bottom) = 0.6s total
      const timer = setTimeout(() => {
        // Update the ref AFTER animation completes
        prevValueRef.current = value;
        setIsFlipping(false);
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [value]); 

  // Card styling
  const cardBg = "bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-700 dark:to-zinc-800";
  const textStyle = `font-mono text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-none select-none text-zinc-800 dark:text-zinc-100 ${colorClass}`;

  // LOGIC TO PREVENT FLICKER:
  // When value changes, there is one render frame before 'isFlipping' becomes true.
  // In this frame, if we show 'currentValue' in the Upper Static card, the user sees a flash of the new number.
  // We must show 'previousValue' in that specific frame.
  // Once flipping starts, Upper Static can show 'currentValue' because it's covered by the Top Flap (which shows previousValue).
  const upperStaticValue = (isValueMismatch && !isFlipping) ? previousValue : currentValue;

  return (
    <div className="flex flex-col items-center mx-1 sm:mx-1.5 md:mx-2">
      {/* Main flip card container */}
      <div 
        className="relative w-14 h-20 sm:w-20 sm:h-28 md:w-24 md:h-36 lg:w-32 lg:h-44 
                   rounded-xl shadow-lg dark:shadow-2xl perspective-1000"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* ============================================ */}
        {/* STATIC BACKGROUND LAYER (Always visible)    */}
        {/* ============================================ */}
        
        {/* UPPER STATIC - Shows the NEW value (usually) */}
        {/* This is revealed when the Top Flap falls down */}
        <div 
          className={`upper-card ${cardBg} flex justify-center items-end rounded-t-xl overflow-hidden`}
          style={{ zIndex: 1 }}
        >
          <span className={`${textStyle} translate-y-1/2`}>
            {upperStaticValue}
          </span>
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent dark:from-black/20 pointer-events-none" />
        </div>

        {/* LOWER STATIC - Shows the OLD value */}
        {/* This stays visible until the Flap lands and covers it */}
        <div 
          className={`lower-card ${cardBg} flex justify-center items-start rounded-b-xl overflow-hidden`}
          style={{ zIndex: 1 }}
        >
          <span className={`${textStyle} -translate-y-1/2`}>
            {previousValue}
          </span>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent dark:from-black/30 pointer-events-none" />
        </div>

        {/* ============================================ */}
        {/* ANIMATED LAYER (Only during flip)           */}
        {/* ============================================ */}
        {isFlipping && (
          <React.Fragment key={flipKey}>
            {/* TOP FLAP - Shows OLD value, flips DOWN */}
            {/* Front face of the falling card */}
            <div 
              className={`upper-card ${cardBg} flex justify-center items-end rounded-t-xl overflow-hidden animate-flip-top-down`}
              style={{ 
                zIndex: 10,
                transformOrigin: 'bottom center',
                backfaceVisibility: 'hidden'
              }}
            >
              <span className={`${textStyle} translate-y-1/2`}>
                {previousValue}
              </span>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 
                             opacity-0 animate-shadow-increase pointer-events-none" />
            </div>

            {/* BOTTOM FLAP - Shows NEW value, flips UP */}
            {/* Back face of the falling card (appears to be falling from top) */}
            <div 
              className={`lower-card ${cardBg} flex justify-center items-start rounded-b-xl overflow-hidden animate-flip-bottom-up`}
              style={{ 
                zIndex: 10,
                transformOrigin: 'top center',
                backfaceVisibility: 'hidden',
                // CRITICAL: Start at 90deg so it's hidden during the animation delay
                transform: 'rotateX(90deg)'
              }}
            >
              <span className={`${textStyle} -translate-y-1/2`}>
                {currentValue}
              </span>
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent 
                             opacity-100 animate-shadow-decrease pointer-events-none" />
            </div>
          </React.Fragment>
        )}

        {/* CENTER HINGE LINE */}
        <div 
          className="absolute top-1/2 left-0 right-0 h-[2px] bg-black/20 dark:bg-black/60 
                     transform -translate-y-1/2 shadow-sm"
          style={{ zIndex: 20 }}
        />
      </div>

      {/* Label */}
      {label && (
        <span className="mt-3 sm:mt-4 text-[10px] sm:text-xs font-bold text-zinc-400 dark:text-zinc-500 
                        uppercase tracking-[0.15em] select-none">
          {label}
        </span>
      )}
    </div>
  );
};

export default FlipDigit;