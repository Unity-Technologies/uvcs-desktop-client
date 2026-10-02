import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from './layoutGraph';
import {
  branchBase,
  branchEnd,
  graphEnd,
  mergeDestination,
  mergeSource,
  neighborStop,
  pageChangeset,
  startingChangeset,
  type GraphDirection,
  type GraphStop,
} from './navigateGraph';

/** What a key asks the selection to do (the Branch Explorer's `graph*` shortcuts). */
export type GraphMove =
  /** An arrow key. */
  | { kind: 'walk'; direction: GraphDirection }
  /** Home and End: the ends of the selection's branch, its pending changes being the last. */
  | { kind: 'branchEdge'; edge: 'first' | 'last' }
  /** The oldest or newest changeset of the whole graph. */
  | { kind: 'graphEdge'; edge: 'first' | 'last' }
  /** Page Up and Down: `columns` is how many a screen holds. */
  | { kind: 'page'; step: 1 | -1; columns: number }
  | { kind: 'mergeSource' }
  | { kind: 'mergeDestination' }
  /** The changeset the selection's branch starts from. */
  | { kind: 'branchBase' };

/** The branch the keys move along: the selected branch, or the branch of the selected changeset or pending changes. */
export function selectedBranchOf(layout: GraphLayout, selection: GraphSelection | null): string | null {
  switch (selection?.kind) {
    case 'branch':
      return selection.name;
    case 'pending':
      return layout.pending?.branch ?? null;
    case 'changeset':
      return layout.nodes.get(selection.id)?.changeset.branch ?? null;
    default:
      return null;
  }
}

/**
 * Where a key moves the selection; null when it goes nowhere. Without a selected changeset, walking and paging start
 * from `startingChangeset` (the selected branch's latest, else the workspace's changeset, else the newest).
 */
export function movedSelection(layout: GraphLayout, selection: GraphSelection | null, homeChangeset: number | null, move: GraphMove): GraphStop | null {
  const selectedId = selection?.kind === 'changeset' ? selection.id : null;
  const branch = selectedBranchOf(layout, selection);
  const starting = (): number | null => startingChangeset(layout, branch, homeChangeset);

  switch (move.kind) {
    case 'walk':
      return selection && selection.kind !== 'branch' ? neighborStop(layout, selection, move.direction) : changesetStop(starting());
    case 'branchEdge':
      if (branch === null) return null;
      // The pending changes are the branch's next changeset, so they are its last stop.
      if (move.edge === 'last' && layout.pending?.branch === branch) return { kind: 'pending' };
      return changesetStop(branchEnd(layout, branch, move.edge));
    case 'graphEdge':
      return changesetStop(graphEnd(layout, move.edge));
    case 'page': {
      const from = selectedId ?? starting();
      return from === null ? null : changesetStop(pageChangeset(layout, from, move.step, move.columns));
    }
    case 'mergeSource':
      return selectedId === null ? null : changesetStop(mergeSource(layout, selectedId));
    case 'mergeDestination':
      return selectedId === null ? null : changesetStop(mergeDestination(layout, selectedId));
    case 'branchBase':
      return branch === null ? null : changesetStop(branchBase(layout, branch));
  }
}

function changesetStop(id: number | null): GraphStop | null {
  return id === null ? null : { kind: 'changeset', id };
}
