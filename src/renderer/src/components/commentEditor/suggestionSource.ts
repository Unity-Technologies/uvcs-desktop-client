/** A list query's state, as TanStack Query gives it. */
export interface ListRead<T> {
  data: readonly T[] | undefined;
  isPending: boolean;
  isError: boolean;
}

/** What a kind's suggestions rank, and where it stands. */
export interface Listed<T> {
  items: readonly T[];
  reading: boolean;
  failed: boolean;
}

/**
 * What a kind's suggestions come from (docs/features/rich-comments.md, "Suggestions"): the whole list once it is read
 * (every branch, every label); until then the server's search of what is typed (`searched`, one `cm find … like`
 * once typing settles), so a repository of 20,000 branches answers in the time of a search. A read failed says so
 * only once nothing else can answer: it never reads as a repository with none.
 */
export function listedFrom<T>(whole: ListRead<T>, searched: ListRead<T> | null): Listed<T> {
  if (whole.data) return { items: whole.data, reading: false, failed: false };
  if (searched?.data) return { items: searched.data, reading: false, failed: false };
  const reading = (whole.isPending && !whole.isError) || (searched !== null && searched.isPending && !searched.isError);
  return { items: [], reading, failed: !reading && whole.isError };
}

/**
 * The cue on the word typed after a trigger, apart from the list: so the field shows it understood `br:` whatever the
 * list does. `reading` pulses while the kind's list is read; nothing once the list is closed (Esc) or the word picked.
 */
export function suggestionCue(state: { recognized: boolean; dismissed: boolean; reading: boolean }): 'reading' | 'ready' | null {
  if (!state.recognized || state.dismissed) return null;
  return state.reading ? 'reading' : 'ready';
}
