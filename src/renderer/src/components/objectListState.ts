/**
 * What a view listing objects shows under its header, which keeps one layout from the first frame on (`ObjectListView`):
 * `loading`, a skeleton of it; `nothing`, empty column titles beside the view's first-use state; `noMatches`, the
 * filters' notice under the column titles; `listed`, the rows beside the focused one's details.
 */
export type ObjectListState = 'loading' | 'nothing' | 'noMatches' | 'listed';

/** `filtering`: filters are on, so no rows means they hide every row read, not that there is none. */
export function objectListState(loading: boolean, rowCount: number, filtering: boolean): ObjectListState {
  if (loading) return 'loading';
  if (rowCount > 0) return 'listed';
  return filtering ? 'noMatches' : 'nothing';
}
