import type { FileDiffMetadata } from '@pierre/diffs';
import { useMemo, useRef, type RefObject } from 'react';
import { listChangeBlocks, listChangeRegions } from './changeBlocks';
import { changesAbove } from './changeNavigation';
import type { ChangeView } from './changeView';
import { useStepNavigation, type StepNavigation, type StepShortcuts } from './useStepNavigation';

const CHANGE_SHORTCUTS: StepShortcuts = { next: 'nextChange', previous: 'previousChange' };

/**
 * Moving from change to change in the diff shown (`diff`, the one `lineDiff` of the text as it is now, so the changes
 * follow what's typed), with the header's arrows and the keys: ⌥↓ ⌥↑, and F7 ⇧F7 which the editor leaves alone while
 * typing (`useStepNavigation`, which also goes on to the files beside it in a list).
 */
export function useChangeNavigation(
  diff: FileDiffMetadata | null,
  view: RefObject<ChangeView | null>,
  frame: RefObject<HTMLElement | null>,
  /** The file shown, as the list beside it names it. */
  path: string,
): StepNavigation {
  const blocks = useMemo(() => (diff ? listChangeBlocks(diff) : []), [diff]);
  const regions = useMemo(() => listChangeRegions(blocks), [blocks]);
  // The last line read at the top of the view, kept for when the diff can't tell (not shown yet).
  const topLine = useRef(1);
  return useStepNavigation({
    steps: regions,
    view: {
      isShown: () => view.current !== null,
      reveal: (index) => view.current?.reveal(regions[index]!),
      show: (index) => view.current?.show(regions[index]!),
      countAbove: () => {
        const line = view.current?.lineAtTop(blocks);
        if (line != null) topLine.current = line;
        return changesAbove(regions, topLine.current);
      },
      aboveAfterChange: () => changesAbove(regions, topLine.current),
    },
    frame,
    path,
    noun: 'change',
    shortcuts: CHANGE_SHORTCUTS,
  });
}
