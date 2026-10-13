import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { flyDirectionOf, flyMoveOf, type FlyDirection } from './flyKeys';
import { flown, type OrbitView } from './orbitCamera';

interface FlyKeys {
  view: () => OrbitView;
  onView: (view: OrbitView) => void;
}

/**
 * Moves the camera while W, A, S, D, Q, E or the arrows are held on the model stage (`flyDirectionOf`): every frame,
 * by the time since the last, so it moves as smoothly as the screen draws, never at the keyboard's repeat. Keys are
 * held by their position (`code`), so one let go with another modifier, or after the stage lost focus, still stops.
 */
export function useFlyKeys({ view, onView }: FlyKeys) {
  const latest = useRef({ view, onView });
  latest.current = { view, onView };
  const held = useRef(new Map<string, FlyDirection>());
  const fast = useRef(false);
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    held.current.clear();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const fly = useCallback(() => {
    let last = performance.now();
    const tick = (now: number): void => {
      const seconds = Math.min((now - last) / 1000, 0.1);
      last = now;
      latest.current.onView(flown(latest.current.view(), flyMoveOf(held.current.values()), seconds, fast.current));
      frame.current = held.current.size > 0 ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  /** Whether the key moves the camera (the caller then lets it do nothing else). */
  const onKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      const direction = flyDirectionOf(event.nativeEvent);
      if (!direction) return false;
      fast.current = event.shiftKey;
      held.current.set(event.code, direction);
      if (frame.current === null) fly();
      return true;
    },
    [fly],
  );
  const onKeyUp = useCallback((event: KeyboardEvent): void => {
    fast.current = event.shiftKey;
    held.current.delete(event.code);
  }, []);
  return { onKeyDown, onKeyUp, onBlur: stop };
}
