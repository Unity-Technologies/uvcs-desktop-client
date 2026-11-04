import type { FileDiffMetadata } from '@pierre/diffs';
import { useMemo, useRef, type RefObject } from 'react';
import { listChangeBlocks, listChangeRegions, type ChangeRegion } from './changeBlocks';
import { changesAbove } from './changeNavigation';
import type { ChangeView } from './changeView';
import type { KeptPresses } from './stepQueue';
import { useStepNavigation, type StepNavigation, type StepShortcuts } from './useStepNavigation';

/** Moving through a diff's changes, and the changes themselves, for the change map (`ChangeMap`). */
export interface ChangeNavigation extends StepNavigation {
  regions: ChangeRegion[];
}

export const CHANGE_SHORTCUTS: StepShortcuts = { next: 'nextChange', previous: 'previousChange' };

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
  {
    active = true,
    noStepsComing = false,
    kept,
  }: {
    /** Its keys work: not while the file selected is another, still loading (`headerArrows`). */
    active?: boolean;
    /** The diff will never have changes to step through (`stepsCanCome`): it opens at once. */
    noStepsComing?: boolean;
    /** Where presses made before it opened wait: its frame's queue (`StepQueue`), bound to this diff. */
    kept?: KeptPresses;
  } = {},
): ChangeNavigation {
  const blocks = useMemo(() => (diff ? listChangeBlocks(diff) : []), [diff]);
  const regions = useMemo(() => listChangeRegions(blocks), [blocks]);
  // The last line read at the top of the view, kept for when the diff can't tell (not shown yet).
  const topLine = useRef(1);
  const navigation = useStepNavigation({
    steps: regions,
    view: {
      isShown: () => view.current !== null,
      reveal: (index) => view.current?.reveal(regions[index]!),
      show: (index) => view.current?.show(regions[index]!),
      opensOnLines: () => view.current?.opensOnLines() ?? false,
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
    active,
    noStepsComing,
    kept,
  });
  return { ...navigation, regions };
}
