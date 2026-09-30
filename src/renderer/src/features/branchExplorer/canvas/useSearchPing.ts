import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import { hitKey, type SearchHit } from '../model/searchGraph';
import { PING_MS } from './searchPing';

/**
 * Plays the sonar ping each time the current search hit changes: a short, finite frame loop, so an idle
 * graph draws nothing. Skipped when the user prefers reduced motion. Returns the ping's progress (1 = settled).
 */
export function useSearchPing(activeHit: SearchHit | null, redraw: () => void): React.RefObject<number> {
  const progressRef = useRef(1);
  // Keyed on the hit's identity: the hits are rebuilt whenever the layout changes.
  const key = activeHit && hitKey(activeHit);

  useEffect(() => {
    progressRef.current = 1;
    if (!key || prefersReducedMotion()) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick() {
      progressRef.current = Math.min(1, (performance.now() - start) / PING_MS);
      redraw();
      if (progressRef.current < 1) frame = requestAnimationFrame(tick);
    });
    progressRef.current = 0;
    return () => cancelAnimationFrame(frame);
  }, [key, redraw]);

  return progressRef;
}
