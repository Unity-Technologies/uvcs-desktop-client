/** Where a "Show more" pressed from the keyboard is, a render after another: `countBefore` changesets were listed then. */
interface ShowMoreProgress {
  countBefore: number;
  count: number;
  loading: boolean;
  /** The read was seen running: it starts a render after the key. */
  started: boolean;
}

export type ShowMoreLanding = { kind: 'land'; index: number } | { kind: 'wait' } | { kind: 'cancel' };

/**
 * What a keyboard "Show more" does next: land on the first changeset of the page read (`index` among the list's rows,
 * "All incoming changes" first), wait while it is read, or give up once the read ended without a page, so a later
 * click on the button lands nowhere (a click never moves the selection).
 */
export function showMoreLanding({ countBefore, count, loading, started }: ShowMoreProgress): ShowMoreLanding {
  if (count > countBefore) return { kind: 'land', index: countBefore + 1 };
  return loading || !started ? { kind: 'wait' } : { kind: 'cancel' };
}
