import { useEffect, useState, type RefObject } from 'react';
import { isTypingIn } from './pierreDom';

/** How long typing has to pause for the change's chip to come back. */
const TYPING_IDLE_MS = 400;

/**
 * Whether the diff's text is being typed into (it changed with the caret in it, a moment ago): the change's chip stays
 * out of the way meanwhile, as the lines move under it. Moving the pointer (`stop`) brings it back.
 */
export function useTypingActivity(containerRef: RefObject<HTMLElement | null>, text: string): { active: boolean; stop: () => void } {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!isTypingIn(containerRef.current)) return setActive(false);
    setActive(true);
    const timer = setTimeout(() => setActive(false), TYPING_IDLE_MS);
    return () => clearTimeout(timer);
  }, [containerRef, text]);
  return { active, stop: () => setActive(false) };
}
