import { useCallback, useEffect, useMemo, useRef } from 'react';
import { accumulateZoom, cubicEaseOut, type ZoomMomentum } from './zoom';

export interface ZoomAnimation {
  /** Folds one zoom step in and glides towards the accumulated target, keeping the anchor still. */
  zoomStep: (anchorX: number, anchorY: number, factor: number) => void;
  /** Freezes the glide where it is; anything else that moves the view calls this first. */
  stop: () => void;
}

/** Turns discrete zoom steps (wheel notches, buttons, keys) into an eased glide; see zoom.ts. */
export function useZoomAnimation(
  /** Sets an absolute zoom keeping the anchor screen point over the same world point. */
  applyZoomAt: (anchorX: number, anchorY: number, zoom: number) => void,
  currentZoom: () => number,
): ZoomAnimation {
  const momentumRef = useRef<ZoomMomentum | null>(null);
  const glideRef = useRef<{ anchorX: number; anchorY: number; from: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const applyRef = useRef(applyZoomAt);
  applyRef.current = applyZoomAt;
  const currentZoomRef = useRef(currentZoom);
  currentZoomRef.current = currentZoom;

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    momentumRef.current = null;
    glideRef.current = null;
  }, []);

  const step = useCallback(() => {
    const momentum = momentumRef.current;
    const glide = glideRef.current;
    if (!momentum || !glide) {
      frameRef.current = null;
      return;
    }
    const t = Math.min(1, (performance.now() - momentum.startedAt) / momentum.duration);
    applyRef.current(glide.anchorX, glide.anchorY, glide.from + (momentum.target - glide.from) * cubicEaseOut(t));
    if (t < 1) {
      frameRef.current = requestAnimationFrame(step);
      return;
    }
    // Landed; the momentum stays so a quick next step compounds from this target.
    glideRef.current = null;
    frameRef.current = null;
  }, []);

  const zoomStep = useCallback(
    (anchorX: number, anchorY: number, factor: number) => {
      const from = currentZoomRef.current();
      momentumRef.current = accumulateZoom(momentumRef.current, from, factor, performance.now());
      glideRef.current = { anchorX, anchorY, from };
      frameRef.current ??= requestAnimationFrame(step);
    },
    [step],
  );

  useEffect(() => stop, [stop]);
  return useMemo(() => ({ zoomStep, stop }), [zoomStep, stop]);
}
