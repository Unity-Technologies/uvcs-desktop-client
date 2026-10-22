import type { SelectedLines } from '../diff/selectedLinesStore';
import type { LineLinks } from '../diff/viewer/lineLinks';
import type { ShownRevision } from './shownRevision';

/** Where a history is, for a link's lines to stay while it stays there (`useFocusUntilMoved`): the revision and its view. */
export function historyPlace(shown: ShownRevision | null): string | undefined {
  return shown ? `${shown.changesetId}:${shown.view}` : undefined;
}

/** A history's lines for links: a link's lines show only annotated, as only an annotation shows a file's lines whole. */
export function historyLineLinks(focus: SelectedLines | null, shown: ShownRevision | null): LineLinks {
  return { focus: shown?.view === 'annotate' ? focus : null, publishes: true };
}
