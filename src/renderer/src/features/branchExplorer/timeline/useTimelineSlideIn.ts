import { useEffect, useRef, useState } from 'react';

/**
 * Whether the Timeline slides in: only once the user shows it while the view is open, never as the view opens with it
 * already shown (the view keeps one layout from its first frame).
 */
export function useTimelineSlideIn(shown: boolean): boolean {
  const shownAtOpen = useRef(shown);
  const [slideIn, setSlideIn] = useState(false);
  useEffect(() => {
    if (shown !== shownAtOpen.current) setSlideIn(shown);
  }, [shown]);
  return slideIn;
}
