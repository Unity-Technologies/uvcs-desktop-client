import { useCallback, useEffect, useRef, useState } from 'react';
import { TOOLTIP_SHOW_DELAY } from '../../../ui/TooltipLayer';

interface CanvasTip {
  text: string;
  /** The pointer when it showed, in client coordinates. */
  pointerX: number;
  pointerY: number;
}

/**
 * A plain tooltip for something drawn on the canvas, living like the app's (`TooltipLayer`): it shows once the pointer
 * has rested on it for the same short delay, anchored where the pointer is then, and goes the moment the pointer
 * leaves. Moving within the same thing (same key) keeps it as it is.
 */
export function useCanvasTip() {
  const [tip, setTip] = useState<CanvasTip | null>(null);
  const shownKey = useRef<string | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((key: string, text: string, clientX: number, clientY: number) => {
    pointer.current = { x: clientX, y: clientY };
    if (shownKey.current === key) return;
    window.clearTimeout(timer.current);
    shownKey.current = key;
    setTip(null);
    timer.current = window.setTimeout(() => setTip({ text, pointerX: pointer.current.x, pointerY: pointer.current.y }), TOOLTIP_SHOW_DELAY);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    shownKey.current = null;
    setTip(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { tip, show, hide };
}
