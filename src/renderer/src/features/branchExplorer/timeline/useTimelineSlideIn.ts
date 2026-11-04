import { useCallback, useEffect, useRef, useState } from 'react';
import { slidesIn } from './timelineSlideIn';

/**
 * Whether the Timeline slides in (`slidesIn`): from the toggle that shows it until its slide is over, which the strip
 * tells (`slidIn`, on its `animationend`).
 */
export function useTimelineSlideIn(shown: boolean): { slideIn: boolean; slidIn: () => void } {
  const shownBefore = useRef(shown);
  const [sliding, setSliding] = useState(false);
  useEffect(() => {
    const before = shownBefore.current;
    shownBefore.current = shown;
    setSliding((current) => slidesIn(before, shown, current));
  }, [shown]);
  const slidIn = useCallback(() => setSliding(false), []);
  return { slideIn: sliding, slidIn };
}
