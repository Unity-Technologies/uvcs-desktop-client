import { useMemo } from 'react';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import type { ComparisonMethod } from './comparisonMethod';
import { diffedText, TYPING_PAUSE_MS } from './diffWhileTyping';
import { methodHidingEveryChange } from './ignoredDifference';
import { hasLineChanges, lineDiff, type LineDiff } from './lineDiff';

interface LineDiffsOptions {
  /** Off for what isn't shown as text: nothing is diffed. */
  isText: boolean;
  original: string;
  /** The modified text as read. */
  saved: string | undefined;
  /** The modified text as it is now, with unsaved edits. */
  current: string;
  comparisonMethod: ComparisonMethod;
  fileName: string;
}

export interface LineDiffs {
  /** Of the file as read: what shows (a diff, or the file typed into whole) and the notes about it stay put while typing. */
  saved: LineDiff | null;
  /** Of the text as it is now (`diffedText`): the header counts it, and the diff shows and discards from it. */
  current: LineDiff | null;
  /** The modified text `current` is of. */
  diffedText: string;
  /** The method that would show no change, when every change of the file as read is what it ignores (`methodHidingEveryChange`). */
  hidingMethod: ComparisonMethod | null;
}

/**
 * The one diff of the texts under the comparison method (`lineDiff`), of the file as read and as it is now with unsaved
 * edits. A big text typed into is diffed again once typing pauses, not at every keystroke (`diffsEveryKeystroke`).
 */
export function useLineDiffs({ isText, original, saved, current, comparisonMethod, fileName }: LineDiffsOptions): LineDiffs {
  const savedDiff = useMemo(() => (isText ? lineDiff(original, saved ?? '', comparisonMethod, fileName) : null), [isText, original, saved, comparisonMethod, fileName]);
  const paused = useDebouncedValue(current, TYPING_PAUSE_MS);
  const diffed = diffedText({ original, saved, current, paused });
  const currentDiff = useMemo(
    () => (isText && diffed !== saved ? lineDiff(original, diffed, comparisonMethod, fileName) : savedDiff),
    [isText, original, saved, diffed, comparisonMethod, fileName, savedDiff],
  );
  const hidingMethod = useMemo(
    () => (savedDiff && hasLineChanges(savedDiff) ? methodHidingEveryChange(original, saved ?? '', comparisonMethod) : null),
    [savedDiff, original, saved, comparisonMethod],
  );
  return { saved: savedDiff, current: currentDiff, diffedText: diffed, hidingMethod };
}
