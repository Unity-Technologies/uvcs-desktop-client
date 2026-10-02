import type { FileDiff } from '@pierre/diffs';
import { useEffect, useRef, type RefObject } from 'react';
import { TYPING_PAUSE_MS } from './diffWhileTyping';
import { refreshWordMarks } from './pierreWordMarks';

interface WordMarksRefresh {
  /** The diff typed into, once the editor attached to it. */
  fileDiff: RefObject<FileDiff<unknown, unknown> | null>;
  /** The modified text as it is now, with unsaved edits. */
  current: string;
  /** What Pierre is given to show: a new one is rendered whole, its words marked. */
  shown: unknown;
}

/**
 * Marks the words that changed in a diff typed into once typing pauses (`TYPING_PAUSE_MS`), on both sides, instead of
 * once the file is saved (`refreshWordMarks`), when the text changed since its words were last marked.
 */
export function useWordMarksRefresh({ fileDiff, current, shown }: WordMarksRefresh): void {
  const marked = useRef({ shown, text: current });
  if (marked.current.shown !== shown) marked.current = { shown, text: current };

  useEffect(() => {
    if (current === marked.current.text) return;
    const timer = setTimeout(() => {
      if (!fileDiff.current) return;
      refreshWordMarks(fileDiff.current);
      marked.current = { shown, text: current };
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [fileDiff, current, shown]);
}
