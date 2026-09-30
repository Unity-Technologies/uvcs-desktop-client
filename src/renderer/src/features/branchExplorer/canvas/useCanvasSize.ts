import { useEffect } from 'react';
import type { Size } from './viewport';

/**
 * Keeps the canvas backing store in sync with its CSS size and the display's pixel ratio. Resizing the
 * backing store clears it, so `onResize` must redraw right away: observers run after layout and before
 * paint, so a redraw there reaches the screen in the same frame.
 */
export function useCanvasSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  sizeRef: React.RefObject<Size>,
  onResize: () => void,
): void {
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      sizeRef.current = { width, height };
      const pixelWidth = Math.round(width * window.devicePixelRatio);
      const pixelHeight = Math.round(height * window.devicePixelRatio);
      // Setting a dimension clears the canvas even when it doesn't change.
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      onResize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, canvasRef, sizeRef, onResize]);
}
