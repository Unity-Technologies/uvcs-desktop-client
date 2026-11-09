import type { DiffEntry } from '@shared/domain/diff';
import { appliedChangeset, entryOfThread } from './commentContext';
import type { LineThread } from './fileThreads';

/**
 * Whether "See in context" lists the files of the changeset that applied a change request, the diff's own list of
 * files (`DiffBrowser`) with the commented one selected: when that changeset (`entries`, its diff, the read "How it
 * was applied" makes anyway) changed the commented file and others with contents to compare, so the user sees what
 * else the fix did. Not otherwise: a thread not applied, a fix of that file alone (nothing more to see), or a request
 * marked applied in a changeset that didn't change the file (the comment would have no file to sit on in the list).
 */
export function listsAppliedFiles(thread: LineThread, entries: readonly DiffEntry[] | undefined): entries is readonly DiffEntry[] {
  if (appliedChangeset(thread) === undefined || !entries) return false;
  const commented = entryOfThread(entries, thread);
  return commented !== undefined && entries.some((entry) => entry !== commented && entry.itemType !== 'directory');
}

/** Whether a file of that changeset is the one the comment is on: by its path, or the one it moved from. */
export function isCommentedEntry(entry: DiffEntry, thread: LineThread): boolean {
  return entryOfThread([entry], thread) !== undefined;
}

/** What the dialog says under its title while another file of the changeset shows. */
export function appliedFilesDescription(thread: LineThread): string {
  return `Changeset ${appliedChangeset(thread)}, which applied it`;
}
