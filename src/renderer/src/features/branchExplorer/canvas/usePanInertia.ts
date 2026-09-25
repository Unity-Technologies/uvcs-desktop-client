import { useCallback, useEffect, useMemo, useRef } from 'react';
import { decayFling, flingVelocity, pushPanSample, type Fling, type PanSample } from './pan';

/** Longer frame gaps (a stall, a hidden window) don't make the graph jump. */
const MAX_FRAME_MS = 64;

export interface PanInertia {
  /** Records a drag position; pass the event's timeStamp so coalesced events keep their real timing. */
  sample: (x: number, y: number, t?: number) => void;
  /** The drag ended: glides on if it was a flick. */
  release: () => void;
  /** Stops the glide dead (a new drag, a wheel, a jump somewhere else). */
  cancel: () => void;
}

/** Keeps a mouse drag gliding after release; see pan.ts. */
export function usePanInertia(
  /** Pans by a screen delta and returns how far the view actually moved once clamped. */
  panBy: (dx: number, dy: number) => { dx: number; dy: number },
): PanInertia {
  const samplesRef = useRef<PanSample[]>([]);
  const flingRef = useRef<Fling | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const panByRef = useRef(panBy);
  panByRef.current = panBy;

  const cancel = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    flingRef.current = null;
    samplesRef.current = [];
  }, []);

  const step = useCallback(() => {
    const fling = flingRef.current;
    if (!fling) {
      frameRef.current = null;
      return;
    }
    const now = performance.now();
    const frame = decayFling(fling, Math.min(MAX_FRAME_MS, now - lastFrameRef.current));
    lastFrameRef.current = now;
    const moved = panByRef.current(frame.dx, frame.dy);
    // An axis stopped by the edge of the graph has nowhere left to glide.
    const vx = Math.abs(moved.dx - frame.dx) > 0.5 ? 0 : frame.next.vx;
    const vy = Math.abs(moved.dy - frame.dy) > 0.5 ? 0 : frame.next.vy;
    if (frame.done || (vx === 0 && vy === 0)) {
      flingRef.current = null;
      frameRef.current = null;
      return;
    }
    flingRef.current = { ...frame.next, vx, vy };
    frameRef.current = requestAnimationFrame(step);
  }, []);

  const sample = useCallback((x: number, y: number, t = performance.now()) => pushPanSample(samplesRef.current, { x, y, t }), []);

  const release = useCallback(() => {
    const fling = flingVelocity(samplesRef.current, performance.now());
    samplesRef.current = [];
    if (!fling) return;
    flingRef.current = fling;
    lastFrameRef.current = performance.now();
    frameRef.current ??= requestAnimationFrame(step);
  }, [step]);

  useEffect(() => cancel, [cancel]);
  return useMemo(() => ({ sample, release, cancel }), [sample, release, cancel]);
}
