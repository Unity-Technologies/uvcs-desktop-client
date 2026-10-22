import { create } from 'zustand';
import type { HistoryRow } from './historyRows';
import { shownRevisionView, type RevisionView } from './revisionView';

/** The revision a history page shows now, as a link to it names it (`pageLinkTarget`). */
export interface ShownRevision {
  /** The history's item, as the page names it. */
  path: string;
  /** The changeset that made the revision (or moved the item). */
  changesetId: number;
  view: 'history' | 'annotate';
  /** The item lives in another repository than the workspace's (under an xlink): no link names its changesets. */
  otherRepository: boolean;
}

/**
 * The revision the history on screen shows: its selection and view are the page's own state (`useHistorySelection`,
 * `usePageRevisionView`), not what it opened on.
 */
export const useShownRevision = create<{ shown: ShownRevision | null }>(() => ({ shown: null }));

/** The revision a history shows: the focused row's, annotated when the view picked can annotate it; none without a row. */
export function shownRevisionOf(path: string, row: HistoryRow | undefined, view: RevisionView, otherRepository: boolean): ShownRevision | null {
  if (!row) return null;
  const changesetId = row.kind === 'revision' ? row.revision.changesetId : row.change.changesetId;
  const annotated = row.kind === 'revision' && shownRevisionView(view, row.revision.itemType) === 'annotate';
  return { path, changesetId, view: annotated ? 'annotate' : 'history', otherRepository };
}

export function sameShownRevision(a: ShownRevision | null, b: ShownRevision | null): boolean {
  if (a === null || b === null) return a === b;
  return a.path === b.path && a.changesetId === b.changesetId && a.view === b.view && a.otherRepository === b.otherRepository;
}

/** Says which revision the history on screen shows, only when it changes: what listens renders the page again. */
export function publishShownRevision(shown: ShownRevision | null): void {
  if (!sameShownRevision(useShownRevision.getState().shown, shown)) useShownRevision.setState({ shown });
}
