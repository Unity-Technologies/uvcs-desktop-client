import type { DiffEntry } from '@shared/domain/diff';
import { appliedChangeset, contextViewLabels, entryOfThread, type ContextView } from './commentContext';
import type { LineThread } from './fileThreads';

/**
 * What the "See in context" dialog shows: one of the thread's two views (`ContextView`), or another file the
 * changeset that applied it changed, by its path.
 */
export type ContextShown = { kind: 'view'; view: ContextView } | { kind: 'file'; path: string };

/** One entry of the dialog's rail: a view of the thread, or another file of the changeset that applied it. */
export type RailItem = { kind: 'view'; view: ContextView; label: string } | { kind: 'file'; entry: DiffEntry };

/**
 * The dialog's rail, for a change request applied in a changeset that changed other files too: its two views first,
 * then what else that changeset did (`entries`, its diff, the read "How it was applied" makes anyway), as its diff
 * lists them. None otherwise (not applied, or applied by changing that file alone): the two views stay a switch in the
 * header. The other files are only those with contents to compare: a folder's diff says no more than its row.
 */
export function contextRailOf(thread: LineThread, entries: readonly DiffEntry[] | undefined): RailItem[] {
  if (appliedChangeset(thread) === undefined || !entries) return [];
  const commented = entryOfThread(entries, thread);
  const others = entries.filter((entry) => entry !== commented && entry.itemType !== 'directory');
  if (others.length === 0) return [];
  const labels = contextViewLabels(thread);
  return [
    { kind: 'view', view: 'commented', label: labels.commented },
    { kind: 'view', view: 'since', label: labels.since },
    ...others.map((entry): RailItem => ({ kind: 'file', entry })),
  ];
}

/** Whether a rail's item is what the dialog shows. */
export function isShown(item: RailItem, shown: ContextShown): boolean {
  if (item.kind === 'view') return shown.kind === 'view' && shown.view === item.view;
  return shown.kind === 'file' && shown.path === item.entry.path;
}

/** What picking a rail's item shows. */
export function shownOf(item: RailItem): ContextShown {
  return item.kind === 'view' ? { kind: 'view', view: item.view } : { kind: 'file', path: item.entry.path };
}

/**
 * The file a rail's pick shows: its entry in the changeset's diff, found by its path (also one under an xlink, picked
 * from the xlink's diff); none for a view, or a file the diff doesn't hold (the thread changed under the dialog).
 */
export function shownFileOf(shown: ContextShown, entries: readonly DiffEntry[] | undefined): DiffEntry | undefined {
  return shown.kind === 'file' ? entries?.find((entry) => entry.path === shown.path) : undefined;
}

/** The rail's heading over the other files: the changeset they were changed in. */
export function otherFilesHeading(thread: LineThread): string {
  return `Also in changeset ${appliedChangeset(thread)}`;
}
