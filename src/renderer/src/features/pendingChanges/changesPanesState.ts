import type { HostDiffs } from '../../components/diffExpansion';

/**
 * What the Changes view's panes hold, which keep one shape from the first read on: `reading`, a skeleton of rows
 * beside an empty diff pane; `nothingPending`, "0 files" beside the empty state; `noMatches`, the filter's notice
 * beside a blank diff pane; `listed`, the list beside the diff of the change selected.
 */
export type ChangesPanesState = 'reading' | 'nothingPending' | 'noMatches' | 'listed';

/** `listedCount` is how many changes were read, undefined until they are; `shownCount`, how many the filters let through. */
export function changesPanesState(listedCount: number | undefined, shownCount: number): ChangesPanesState {
  if (listedCount === undefined) return 'reading';
  if (listedCount === 0) return 'nothingPending';
  return shownCount === 0 ? 'noMatches' : 'listed';
}

/**
 * The diffs Changes can show, for an expanded diff to end once there are none (`collapsesWithHost`): nothing pending,
 * or the filter (out of sight while expanded) hiding every change.
 */
export function changesDiffs(state: ChangesPanesState): HostDiffs {
  if (state === 'reading') return 'reading';
  return state === 'listed' ? 'some' : 'none';
}
