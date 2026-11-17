/**
 * A row a table is asked to scroll to (`DataTable`'s `revealKey` and `revealCount`): its key, and how many times one was asked for. The
 * count makes each request new, so the same row asked for again (Go to file on the file already selected, in a view
 * kept mounted where the user scrolled it away) is shown again, while the view showing again asks nothing.
 */
export interface RowReveal {
  key: string | null;
  asked: number;
}

/** No row asked for yet. */
export const NO_ROW_REVEAL: RowReveal = { key: null, asked: 0 };

/** The request after `previous` for the row `key`: a new one, the same row asked for again included. */
export function revealAsked(previous: RowReveal, key: string): RowReveal {
  return { key, asked: previous.asked + 1 };
}
