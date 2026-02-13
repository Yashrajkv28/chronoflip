import React, { useEffect, useState } from 'react';

interface SegmentTransitionProps {
  fromName: string;
  toName: string;
  toColor: string;
  onComplete: () => void;
  duration?: number; // ms, default 2500
}

const SegmentTransition: React.FC<SegmentTransitionProps> = ({
  fromName,
  toName,
  toColor,
  onComplete,
  duration = 2500,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors duration-500"
         style={{ backgroundColor: toColor + 'DD' }}>
      <div className="text-center space-y-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="text-white/60 text-sm font-semibold uppercase tracking-widest">
          {fromName}
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-[2px] bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-100"
                 style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="text-white text-xl font-bold tracking-[0.2em]">AUTO</span>
          <div className="w-16 h-[2px] bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-100"
                 style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="text-white text-2xl font-bold">
          {toName}
        </div>
      </div>
    </div>
  );
};

export default SegmentTransition;
