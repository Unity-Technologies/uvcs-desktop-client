import { useEffect, useState } from 'react';

/** How long typing pauses before what the text renders as (an image, a model) follows it. */
export const TYPING_PAUSE_MS = 400;

/**
 * `text` once typing pauses: rendering it (encoding an SVG, parsing an OBJ or a `.meta`'s model) costs far more than
 * a keystroke, and every one rendered would queue behind the next. The first text shows at once.
 */
export function useTypingPause(text: string, delayMs = TYPING_PAUSE_MS): string {
  const [paused, setPaused] = useState(text);
  useEffect(() => {
    if (text === paused) return;
    const timer = setTimeout(() => setPaused(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, paused, delayMs]);
  return paused;
}
