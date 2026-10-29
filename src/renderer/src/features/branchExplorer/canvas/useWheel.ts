import { useEffect, useRef } from 'react';

/**
 * Wheel and trackpad events with the pointer position in the container, never zooming the page. An event `passes`
 * says is another element's (a caption card's comment, `wheelGoesTo`) is left to the browser to scroll it.
 */
export function useWheel(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onWheel: (event: WheelEvent, x: number, y: number) => void,
  passes: (event: WheelEvent) => boolean = () => false,
): void {
  const handlerRef = useRef({ onWheel, passes });
  handlerRef.current = { onWheel, passes };
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = (event: WheelEvent): void => {
      if (handlerRef.current.passes(event)) return;
      event.preventDefault();
      const bounds = container.getBoundingClientRect();
      handlerRef.current.onWheel(event, event.clientX - bounds.left, event.clientY - bounds.top);
    };
    // Registered natively: React's wheel listeners are passive and cannot prevent page zoom.
    container.addEventListener('wheel', listener, { passive: false });
    return () => container.removeEventListener('wheel', listener);
  }, [containerRef]);
}
