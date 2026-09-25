import { useCallback, useEffect, useMemo, useRef } from 'react';
import { interpolateViewport, type Size, type Viewport } from './viewport';
import { cubicEaseOut } from './zoom';

const GLIDE_MS = 420;

export interface ViewportGlide {
  /** Glides from the current viewport to `target`, e.g. to frame something revealed from elsewhere. */
  glideTo: (target: Viewport) => void;
  stop: () => void;
}

/** Eased pan-and-zoom from one viewport to another; anything else that moves the view stops it first. */
export function useViewportGlide(apply: (viewport: Viewport) => void, current: () => Viewport, screen: () => Size): ViewportGlide {
  const frameRef = useRef<number | null>(null);
  const latest = useRef({ apply, current, screen });
  latest.current = { apply, current, screen };

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const glideTo = useCallback(
    (target: Viewport) => {
      stop();
      const from = latest.current.current();
      const startedAt = performance.now();
      const step = (): void => {
        const t = Math.min(1, (performance.now() - startedAt) / GLIDE_MS);
        latest.current.apply(t === 1 ? target : interpolateViewport(from, target, cubicEaseOut(t), latest.current.screen()));
        frameRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  return useMemo(() => ({ glideTo, stop }), [glideTo, stop]);
}
