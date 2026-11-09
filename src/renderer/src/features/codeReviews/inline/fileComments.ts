import type { DiffLineAnnotation } from '@pierre/diffs';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ChangedLine } from '../../diff/viewer/changeBlocks';
import type { ReviewThread } from '../conversation/reviewThreads';
import { earlierRevisions, placeEarlier, threadsOfFile, writtenIn, type EarlierThread, type ReviewDiffView, type ShownFile, type ThreadSide } from './fileThreads';
import { newerLineFinder } from './newerLine';
import { hasComments } from './fileAnnotation';
import { lineOfThread, lineThreadsOf, type LineThreads, type ShownThreadRows } from './threadRows';

/** A file's threads as its diff shows them: by line, and those outdated, apart above the code. */
export interface FileComments {
  lines: LineThreads[];
  outdated: EarlierThread[];
  /** On an earlier version not read yet: placed at a line or outdated once it is. */
  reading: EarlierThread[];
}

interface FileCommentsInput {
  threads: readonly ReviewThread[];
  review: CodeReviewTarget;
  view: ReviewDiffView;
  file: ShownFile;
  /** An earlier version's text once read, the newer side's (`file.modifiedRevision`) among them. */
  textOf: (revisionId: number) => string | undefined;
}

/**
 * Where a file's threads show (`threadsOfFile`, `placeEarlier`): those on a version the diff shows at their line, those
 * on an earlier one at their line now when it's unchanged since, the rest outdated. Until the earlier versions are read,
 * their threads wait (none shows outdated only to move a moment later).
 */
export function fileCommentsOf({ threads, review, view, file, textOf }: FileCommentsInput): FileComments {
  const { placed, earlier } = threadsOfFile(threads, review, view, file);
  const newer = file.modifiedRevision === -1 ? null : textOf(file.modifiedRevision);
  const lineIn = typeof newer === 'string' ? newerLineFinder(newer) : null;
  const placedEarlier = placeEarlier(
    earlier,
    (revisionId) => (newer === undefined ? undefined : textOf(revisionId)),
    (text, line) => (lineIn === null ? null : lineIn(text, line)),
    (thread) => writtenIn(review, thread).kind === view.kind,
  );
  return { lines: lineThreadsOf([...placed, ...placedEarlier.placed]), outdated: placedEarlier.outdated, reading: placedEarlier.reading };
}

/**
 * The versions of a file to read to place its threads (`useFileVersionTexts`): those written on an earlier version, and
 * the newer side's text to find their lines in. None when every thread is on a version the diff shows.
 */
export function versionsToRead({ threads, review, view, file }: Omit<FileCommentsInput, 'textOf'>): number[] {
  const { earlier } = threadsOfFile(threads, review, view, file);
  const revisions = earlierRevisions(earlier);
  if (revisions.length === 0 || file.modifiedRevision === -1 || revisions.includes(file.modifiedRevision)) return revisions;
  return [...revisions, file.modifiedRevision];
}

/** The side a file's rows above its code go on: the one it has, the older for a deleted file. */
export function topSideOf(file: Pick<ShownFile, 'modifiedRevision'>): ThreadSide {
  return file.modifiedRevision === -1 ? 'deletions' : 'additions';
}

/** Whether a file's diff offers the comments' controls: it has threads, or is compared since one. */
export function showsCommentControls(comments: Pick<FileComments, 'lines' | 'outdated'> | null, comparingSince: boolean): boolean {
  return comparingSince || hasComments(comments);
}

/** The row above the code holding a file's outdated threads (`lineNumber: 0`). */
export const OUTDATED_ROW = 'outdated';

/**
 * Pierre's rows for a file's threads: each line's shown, named by its key (`LineThreads.key`), and the outdated ones
 * above the code, on the side the file has (a deleted file has only its older one).
 *
 * Where a row shows is its line's; its place in the list is only how Pierre keys its slot (by index, in
 * `renderDiffChildren`), and a row whose index changes is mounted anew, an open reply closed. So rows that come later
 * go after: the lines with a thread on a version shown first, then those placed once an earlier version is read, then
 * the outdated ones. Hidden (`inCode` false), the outdated ones come first, there before any line is opened, and the
 * lines follow in the order they were opened (`shownThreadRows`).
 */
export function annotationRowsOf(shown: Pick<ShownThreadRows, 'rows'>, outdated: readonly EarlierThread[], topSide: ThreadSide, inCode = true): DiffLineAnnotation<string>[] {
  const onShownVersion = (line: LineThreads): boolean => line.threads.some((entry) => entry.earlier === undefined);
  const ordered = [...shown.rows.filter(onShownVersion), ...shown.rows.filter((line) => !onShownVersion(line))];
  const rows = ordered.map((line): DiffLineAnnotation<string> => ({ side: line.side, lineNumber: line.line, metadata: line.key }));
  if (outdated.length === 0) return rows;
  const outdatedRow: DiffLineAnnotation<string> = { side: topSide, lineNumber: 0, metadata: OUTDATED_ROW };
  return inCode ? [...rows, outdatedRow] : [outdatedRow, ...rows];
}

/**
 * Whether the file's diff has a thread, at a line, outdated, or still being placed: a diff opened to go to it opens at
 * it, not at its first change (`DiffAnnotations.opensAtRow`), even before its earlier version is read.
 */
export function holdsThread(comments: FileComments | null, threadId: number): boolean {
  if (!comments) return false;
  const isIt = (entry: EarlierThread): boolean => entry.thread.root.id === threadId;
  return lineOfThread(comments.lines, threadId) !== undefined || comments.outdated.some(isIt) || comments.reading.some(isIt);
}

/** Where a thread gone to is in the file's diff: at its line, or above the code when outdated; none when not here. */
export function threadPlace(comments: Pick<FileComments, 'lines' | 'outdated'>, threadId: number, topSide: ThreadSide): (ChangedLine & { lineKey?: string }) | null {
  const line = lineOfThread(comments.lines, threadId);
  if (line) return { side: line.side, lineNumber: line.line, lineKey: line.key };
  // Above the code (`lineNumber: 0`): the diff scrolls to its top.
  if (comments.outdated.some((entry) => entry.thread.root.id === threadId)) return { side: topSide, lineNumber: 0 };
  return null;
}
