import type { FileDiff } from '@pierre/diffs';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { TYPING_PAUSE_MS } from './diffWhileTyping';
import { refreshWordMarks } from './pierreWordMarks';

interface WordMarksRefresh {
  /** The diff typed into, once the editor attached to it. */
  fileDiff: RefObject<FileDiff<unknown, unknown> | null>;
  /** The element the diff renders in: compositions (an input method's) in it hold the marks back. */
  containerRef: RefObject<HTMLElement | null>;
  /** The modified text as it is now, with unsaved edits. */
  current: string;
  /** What Pierre is given to show: a new one is rendered whole, its words marked. */
  shown: unknown;
}

/**
 * Marks the words that changed in a diff typed into once typing pauses (`TYPING_PAUSE_MS`), on both sides, instead of
 * once the file is saved (`refreshWordMarks`), when the text changed since its words were last marked. Never while an
 * input method composes text (Japanese, Chinese, accents): redrawing the rows under it would end the composition; the
 * marks come once it ends.
 */
export function useWordMarksRefresh({ fileDiff, containerRef, current, shown }: WordMarksRefresh): void {
  const marked = useRef({ shown, text: current });
  if (marked.current.shown !== shown) marked.current = { shown, text: current };
  const composing = useRef(false);
  const [compositionsEnded, setCompositionsEnded] = useState(0);

  // Listened for on the document, as the container may mount after this hook first runs; a composition elsewhere
  // (the checkin comment) isn't this diff's.
  useEffect(() => {
    const inDiff = (event: Event): boolean => event.target instanceof Node && containerRef.current?.contains(event.target) === true;
    const start = (event: Event): void => {
      if (inDiff(event)) composing.current = true;
    };
    const end = (): void => {
      if (!composing.current) return;
      composing.current = false;
      setCompositionsEnded((count) => count + 1);
    };
    document.addEventListener('compositionstart', start, true);
    document.addEventListener('compositionend', end, true);
    return () => {
      document.removeEventListener('compositionstart', start, true);
      document.removeEventListener('compositionend', end, true);
    };
  }, [containerRef]);

  useEffect(() => {
    if (current === marked.current.text) return;
    const timer = setTimeout(() => {
      if (!fileDiff.current || composing.current) return;
      refreshWordMarks(fileDiff.current);
      marked.current = { shown, text: current };
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [fileDiff, current, shown, compositionsEnded]);
}
