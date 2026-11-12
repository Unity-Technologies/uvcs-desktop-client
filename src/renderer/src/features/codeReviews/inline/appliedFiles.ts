import { MessageSquare } from 'lucide-react';
import type { DiffEntry } from '@shared/domain/diff';
import type { EntryFlag } from '../../diff/entryFlag';
import { settlingChangeset, entryOfThread, type ContextView } from './commentContext';
import type { ContextComparisonState } from './contextComparisonState';
import type { LineThread } from './fileThreads';

/**
 * What "See in context" shows of the changeset that applied a change request (`entries`, its diff, the read "How it was
 * applied" makes anyway), the diff's own list of files (`DiffBrowser`):
 * - `withComment`: it changed the commented file and others with contents to compare; listed in both views, the
 *   commented file selected, so the user sees what else the fix did.
 * - `withoutComment`: it changed other files only (the request was applied elsewhere: a test added, a sibling fixed);
 *   listed in "How it was applied", the thread above them, since no diff of its file has it to sit on.
 * - `none`: a thread not applied, a fix of that file alone (nothing more to see), a changeset with no file to compare,
 *   or one not read yet.
 */
export type AppliedFiles = 'withComment' | 'withoutComment' | 'none';

export function appliedFilesOf(thread: LineThread, entries: readonly DiffEntry[] | undefined): AppliedFiles {
  if (settlingChangeset(thread) === undefined || !entries) return 'none';
  const commented = entryOfThread(entries, thread);
  const others = entries.some((entry) => entry !== commented && entry.itemType !== 'directory');
  if (!others) return 'none';
  return commented ? 'withComment' : 'withoutComment';
}

/** Whether a view lists the changeset's files (`appliedFilesOf`): its other files show in "How it was applied" alone. */
export function listsAppliedFiles(files: AppliedFiles, view: ContextView): boolean {
  return files === 'withComment' || (files === 'withoutComment' && view === 'since');
}

/**
 * What the dialog's body shows for a view, given what it shows of the changeset that applied the thread (`files`) and
 * its comparison's state (`comparison`, `contextComparisonState`):
 * - `threadAboveFiles`: the changeset's files, the thread above them, in How it was applied when that changeset didn't
 *   change the commented file. It wins over `threadAlone`, which that case also is: else the view is a dead end.
 * - `threadAlone`: the thread and one line saying why there's no diff (a changeset with no file to compare).
 * - `files`: the changeset's files, the commented one with the thread at its line.
 * - `diff`: the commented file's diff alone, or why it can't show.
 */
export type ContextBody = 'threadAboveFiles' | 'threadAlone' | 'files' | 'diff';

export function contextBodyOf(files: AppliedFiles, view: ContextView, comparison: ContextComparisonState['kind']): ContextBody {
  if (listsAppliedFiles(files, view)) return files === 'withoutComment' ? 'threadAboveFiles' : 'files';
  return comparison === 'notInChangeset' ? 'threadAlone' : 'diff';
}

/**
 * What the dialog's header is about: the commented file's diff (its description, and the switch between its two views),
 * or the changeset's files while another one is selected. Listing files without the comment, the switch stays: it
 * leads back to the diff the comment was written on.
 */
export interface AppliedFilesHeading {
  describesComment: boolean;
  offersViews: boolean;
}

export function appliedFilesHeading(files: AppliedFiles, view: ContextView, commentedSelected: boolean): AppliedFilesHeading {
  if (!listsAppliedFiles(files, view)) return { describesComment: true, offersViews: true };
  if (files === 'withoutComment') return { describesComment: false, offersViews: true };
  return { describesComment: commentedSelected, offersViews: commentedSelected };
}

/** Whether a file of that changeset is the one the comment is on: by its path, or the one it moved from. */
export function isCommentedEntry(entry: DiffEntry, thread: LineThread): boolean {
  return entryOfThread([entry], thread) !== undefined;
}

/**
 * What the dialog says under its title while another file of the changeset shows: that the changeset applied it, or,
 * when it didn't change the commented file (`withoutComment`), that it applied it in other files.
 */
export function appliedFilesDescription(thread: LineThread, files: AppliedFiles): string {
  const changeset = settlingChangeset(thread);
  return files === 'withoutComment' ? `Changeset ${changeset} applied it in other files` : `Changeset ${changeset}, which applied it`;
}

/** In that list, the commented file marked as the review's are (`reviewFileFlag`), with no chip: it's one file. */
export function commentedFileFlag(thread: LineThread): EntryFlag {
  return { icon: MessageSquare, markOf: () => (entry) => (isCommentedEntry(entry, thread) ? 'The comment is on this file' : null) };
}
