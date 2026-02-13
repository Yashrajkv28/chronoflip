import { useState, useEffect, useCallback } from 'react';

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen] = useState(() =>
    !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled)
  );
  const [isStandalone] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );

  const toggle = useCallback(() => {
    const doc = document as any;
    const el = document.documentElement as any;
    const isFS = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    if (!isFS) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el).catch((err: Error) => console.warn('Fullscreen failed:', err));
    } else {
      const exit = document.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const doc = document as any;
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  return { isFullscreen, canFullscreen, isStandalone, toggle };
}
