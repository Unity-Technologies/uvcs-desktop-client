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
