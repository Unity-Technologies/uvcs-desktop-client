/**
 * What a view listing objects shows under its header, which keeps one layout from the first frame on (`ObjectListView`):
 * `loading`, a skeleton of it; `nothing`, empty column titles beside the view's first-use state; `noMatches`, the
 * filters' notice under the column titles beside a blank details pane; `listed`, the rows beside the focused one's details.
 */
export type ObjectListState = 'loading' | 'nothing' | 'noMatches' | 'listed';

interface ObjectListRead {
  /** No rows have been read yet. */
  loading: boolean;
  rowCount: number;
  /** Filters are on: no rows means they hide every row read, not that there is none. */
  filtering: boolean;
}

export function objectListState({ loading, rowCount, filtering }: ObjectListRead): ObjectListState {
  if (loading) return 'loading';
  if (rowCount > 0) return 'listed';
  return filtering ? 'noMatches' : 'nothing';
}

/** Where each part of a listed view goes (`ObjectListView`): what the list says under its column titles, and the details. */
export interface ObjectListLayout {
  /** Under the column titles while there is no row: the filters' notice, the view's first-use state, or nothing. */
  inList: 'noMatches' | 'emptyState' | null;
  /** In the details pane: the view's first-use state, nothing, or the focused row's details. */
  inDetails: 'emptyState' | 'blank' | 'selected';
}

/** Where a listed view's states show: its first-use state beside the list, or in it while the details are hidden. */
export function objectListLayout(state: Exclude<ObjectListState, 'loading'>, detailsHidden: boolean): ObjectListLayout {
  if (state === 'listed') return { inList: null, inDetails: 'selected' };
  if (state === 'noMatches') return { inList: 'noMatches', inDetails: 'blank' };
  return detailsHidden ? { inList: 'emptyState', inDetails: 'blank' } : { inList: null, inDetails: 'emptyState' };
}
