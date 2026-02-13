import { useRef, useState, useCallback, useEffect } from 'react';

interface UseSwipeToDeleteOptions {
  onDelete: () => void;
  disabled?: boolean;
  /** When this value changes and doesn't match the card's own ID, close the swipe */
  openId?: string | null;
  /** The card's own ID, used with openId for one-open-at-a-time */
  id?: string;
  /** Called when this card's swipe opens */
  onOpen?: (id: string) => void;
}

interface UseSwipeToDeleteReturn {
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handlePointerCancel: (e: React.PointerEvent) => void;
  offsetX: number;
  isOpen: boolean;
  isTracking: boolean;
  close: () => void;
  deleteZoneProps: { onClick: () => void };
}

const THRESHOLD = 20;
const MAX_SWIPE = -80;
const DIRECTION_LOCK_PX = 5;
const VERTICAL_RATIO = 1.2;

export function useSwipeToDelete({
  onDelete,
  disabled = false,
  openId,
  id,
  onOpen,
}: UseSwipeToDeleteOptions): UseSwipeToDeleteReturn {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const directionRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const pointerIdRef = useRef<number | null>(null);
  const wasSwipingRef = useRef(false);

  const close = useCallback(() => {
    setOffsetX(0);
    setIsOpen(false);
    setIsTracking(false);
  }, []);

  // Close when another card opens
  useEffect(() => {
    if (openId !== undefined && id && openId !== id && isOpen) {
      close();
    }
  }, [openId, id, isOpen, close]);

  const elementRef = useRef<HTMLElement | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    wasSwipingRef.current = false;

    // If already open and user taps card content, close it
    if (isOpen) {
      close();
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    trackingRef.current = true;
    directionRef.current = 'none';
    setIsTracking(true);

    // Store element ref but DON'T capture yet — capture only after horizontal lock
    // to avoid eating click events on taps
    elementRef.current = e.currentTarget as HTMLElement;
  }, [disabled, isOpen, close]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!trackingRef.current || e.pointerId !== pointerIdRef.current) return;

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;
    const absDX = Math.abs(deltaX);
    const absDY = Math.abs(deltaY);

    // Lock direction on first significant movement
    if (directionRef.current === 'none') {
      if (absDX < DIRECTION_LOCK_PX && absDY < DIRECTION_LOCK_PX) return;

      if (absDY > absDX * VERTICAL_RATIO) {
        directionRef.current = 'vertical';
        trackingRef.current = false;
        setIsTracking(false);
        return;
      }
      directionRef.current = 'horizontal';
      // Now capture pointer to ensure we get all move/up events during swipe
      if (elementRef.current && pointerIdRef.current !== null) {
        elementRef.current.setPointerCapture(pointerIdRef.current);
      }
    }

    if (directionRef.current !== 'horizontal') return;

    wasSwipingRef.current = true;

    // Only allow left swipe with rubber-band on right
    let clamped: number;
    if (deltaX > 0) {
      clamped = deltaX * 0.2;
    } else {
      clamped = Math.max(MAX_SWIPE * 1.2, deltaX);
    }
    setOffsetX(clamped);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    if (!trackingRef.current && !wasSwipingRef.current) {
      setIsTracking(false);
      return;
    }

    trackingRef.current = false;
    directionRef.current = 'none';
    setIsTracking(false);

    const deltaX = e.clientX - startXRef.current;

    if (deltaX < THRESHOLD * -1) {
      setOffsetX(MAX_SWIPE);
      setIsOpen(true);
      if (onOpen && id) onOpen(id);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  }, [onOpen, id]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    trackingRef.current = false;
    directionRef.current = 'none';
    setOffsetX(0);
    setIsOpen(false);
    setIsTracking(false);
  }, []);

  const deleteZoneProps = {
    onClick: () => {
      onDelete();
      setOffsetX(0);
      setIsOpen(false);
      setIsTracking(false);
    },
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    offsetX,
    isOpen,
    isTracking,
    close,
    deleteZoneProps,
  };
}
