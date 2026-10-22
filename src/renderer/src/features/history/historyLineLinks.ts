import type { SelectedLines } from '../diff/selectedLinesStore';
import type { LineLinks } from '../diff/viewer/lineLinks';
import type { ShownRevision } from './shownRevision';

/** Where a history is, for a link's lines to stay while it stays there (`useFocusUntilMoved`): the revision and its view. */
export function historyPlace(shown: ShownRevision | null): string | undefined {
  return shown ? `${shown.changesetId}:${shown.view}` : undefined;
}

/**
 * A history's lines for links: only annotated, as only an annotation shows a file's lines whole and a history's link
 * names lines only there: a link's lines show, and the lines selected are published (for the chip and ⇧⌘C).
 */
export function historyLineLinks(focus: SelectedLines | null, shown: ShownRevision | null): LineLinks {
  const annotated = shown?.view === 'annotate';
  return { focus: annotated ? focus : null, publishes: annotated };
}
