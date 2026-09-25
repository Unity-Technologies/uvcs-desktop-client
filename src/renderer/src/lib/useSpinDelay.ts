import { useEffect, useRef, useState } from 'react';

/**
 * Flicker-free loading flag. Returns true only once `loading` has been set for at least
 * `delay` ms: fast loads (the common case) never show a spinner at all, the previous content
 * just swaps for the new one. Once shown, the spinner stays up for at least `minDuration` ms
 * so it can't flash either.
 */
export function useSpinDelay(loading: boolean, delay = 300, minDuration = 250): boolean {
  const [show, setShow] = useState(false);
  // When the spinner became visible; drives the minimum display time.
  const shownAt = useRef(0);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
      return () => clearTimeout(timer);
    }
    const remaining = shownAt.current + minDuration - Date.now();
    if (remaining > 0) {
      const timer = setTimeout(() => setShow(false), remaining);
      return () => clearTimeout(timer);
    }
    setShow(false);
    return undefined;
  }, [loading, delay, minDuration]);

  return show;
}
