import { otherRepository } from '@shared/domain/repository';
import type { DiffEntry } from '@shared/domain/diff';
import type { FileComments } from './fileComments';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewThread } from '../conversation/reviewThreads';
import { threadsOfFile, type EarlierThread, type ReviewDiffView, type ShownFile } from './fileThreads';
import type { ThreadFocus } from './reviewComments';

/**
 * Whether a file of a review's diff can hold comments: a file of the review's repository. A directory has no lines, and
 * an item under an xlink is another repository's, whose revisions the review's comments can't name (`cm` refuses them).
 */
export function isCommentable(entry: Pick<DiffEntry, 'itemType' | 'repository'>, placeRepository: string | undefined): boolean {
  return entry.itemType !== 'directory' && otherRepository(entry.repository, placeRepository) === undefined;
}

/** The file as its diff shows it: the entry's path and revisions. */
export function comparedFile(entry: Pick<DiffEntry, 'path' | 'oldPath' | 'baseRevisionId' | 'revisionId'>): ShownFile {
  return { path: entry.path, oldPath: entry.oldPath, originalRevision: entry.baseRevisionId, modifiedRevision: entry.revisionId };
}

/**
 * How many threads a file of the review's diff holds in `view` (`threadsOfFile`), for its row's mark in the list. Read
 * from the threads alone, as the list reads no file: an outdated one written changeset by changeset counts in the whole
 * branch's list too, though only its changeset's diff shows it (`placeEarlier`), a rare case not worth reading versions for.
 */
export function fileThreadCount(threads: readonly ReviewThread[], review: CodeReviewTarget, view: ReviewDiffView, entry: Pick<DiffEntry, 'path' | 'oldPath' | 'baseRevisionId' | 'revisionId'>): number {
  const { placed, earlier } = threadsOfFile(threads, review, view, comparedFile(entry));
  return placed.length + earlier.length;
}

/** Whether a file shows anything of its threads: some at their lines, or outdated ones. */
export function hasComments(comments: Pick<FileComments, 'lines' | 'outdated'> | null): comments is FileComments {
  return comments !== null && (comments.lines.length > 0 || comments.outdated.length > 0);
}

/**
 * The lines opened while comments are hidden, once a thread on one is gone to: its line opens, after the others (the
 * order rows keep, `annotationRowsOf`). Unchanged when comments show in the code, or the thread is at no line.
 */
export function openedOnFocus(opened: readonly string[], lineKey: string | undefined, inCode: boolean): readonly string[] {
  if (inCode || lineKey === undefined || opened.includes(lineKey)) return opened;
  return [...opened, lineKey];
}

/** Whether the outdated threads above the code open: when one of them is gone to. */
export function outdatedOpensFor(focus: ThreadFocus | null, outdated: readonly EarlierThread[]): boolean {
  return focus !== null && outdated.some((entry) => entry.thread.root.id === focus.threadId);
}
