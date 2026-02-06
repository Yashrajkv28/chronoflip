import React from 'react';
import FlipDigit from './FlipDigit';

interface FlipClockDisplayProps {
  hours: number;
  minutes: number;
  seconds: number;
  showHours?: boolean;
  showDays?: boolean;
  days?: number;
  colorClass?: string;
  isRunning?: boolean;
}

const FlipClockDisplay: React.FC<FlipClockDisplayProps> = ({
  hours,
  minutes,
  seconds,
  showHours = true,
  showDays = false,
  days = 0,
  colorClass = '',
  isRunning = false,
}) => {
  // Pad numbers to always show two digits
  const pad = (num: number): [string, string] => {
    const padded = Math.max(0, num).toString().padStart(2, '0');
    return [padded[0], padded[1]];
  };

  const [h1, h2] = pad(hours);
  const [m1, m2] = pad(minutes);
  const [s1, s2] = pad(seconds);
  const [d1, d2] = showDays ? pad(days) : ['0', '0'];

  // Separator component with colon dots
  const Separator: React.FC = () => (
    <div className="flex flex-col justify-center items-center mx-1 sm:mx-2 md:mx-3 
                    h-20 sm:h-28 md:h-36 lg:h-44">
      <div className={`flex flex-col gap-3 sm:gap-4 md:gap-5 transition-opacity duration-300
                      ${isRunning ? 'animate-blink' : ''}`}>
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full 
                       bg-zinc-400 dark:bg-zinc-500 shadow-sm" />
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full 
                       bg-zinc-400 dark:bg-zinc-500 shadow-sm" />
      </div>
    </div>
  );

  return (
    <div className={`flex items-center justify-center color-transition ${colorClass}`}>
      {/* Days */}
      {showDays && (
        <>
          <div className="flex">
            <FlipDigit value={d1} colorClass={colorClass} />
            <FlipDigit value={d2} label="Days" colorClass={colorClass} />
          </div>
          <Separator />
        </>
      )}

      {/* Hours */}
      {showHours && (
        <>
          <div className="flex">
            <FlipDigit value={h1} colorClass={colorClass} />
            <FlipDigit value={h2} label="Hours" colorClass={colorClass} />
          </div>
          <Separator />
        </>
      )}

      {/* Minutes */}
      <div className="flex">
        <FlipDigit value={m1} colorClass={colorClass} />
        <FlipDigit value={m2} label="Minutes" colorClass={colorClass} />
      </div>
      
      <Separator />

      {/* Seconds */}
      <div className="flex">
        <FlipDigit value={s1} colorClass={colorClass} />
        <FlipDigit value={s2} label="Seconds" colorClass={colorClass} />
      </div>
    </div>
  );
};

export default React.memo(FlipClockDisplay);