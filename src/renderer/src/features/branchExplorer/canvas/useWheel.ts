import { useEffect, useRef } from 'react';

/** Wheel and trackpad events with the pointer position in the container, never zooming the page. */
export function useWheel(containerRef: React.RefObject<HTMLDivElement | null>, onWheel: (event: WheelEvent, x: number, y: number) => void): void {
  const handlerRef = useRef(onWheel);
  handlerRef.current = onWheel;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = (event: WheelEvent): void => {
      event.preventDefault();
      const bounds = container.getBoundingClientRect();
      handlerRef.current(event, event.clientX - bounds.left, event.clientY - bounds.top);
    };
    // Registered natively: React's wheel listeners are passive and cannot prevent page zoom.
    container.addEventListener('wheel', listener, { passive: false });
    return () => container.removeEventListener('wheel', listener);
  }, [containerRef]);
}
