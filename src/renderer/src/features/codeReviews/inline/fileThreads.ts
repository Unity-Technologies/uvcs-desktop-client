import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { DiffTarget } from '@shared/domain/diff';
import type { FileAnchor, ImageSpot, ReviewCommentAnchor } from '@shared/domain/reviewConversation';
import type { ReviewThread } from '../conversation/reviewThreads';

/**
 * Which of a review's diffs the Changes tab shows: the whole review's (all a branch's changes, or several of its
 * changesets as one diff; a changeset's, a shelve's) or one changeset of a branch, picked in the list of its
 * changesets. A comment belongs to the one it was
 * written in (`ReviewComment.changesetId`), as the official client keeps them.
 */
export type ReviewDiffView = { kind: 'whole' } | { kind: 'changeset'; changesetId: number };

/** The view a diff of a review is: a changeset diffed inside a branch's review is that changeset's. */
export function reviewDiffViewOf(review: CodeReviewTarget, diff: DiffTarget): ReviewDiffView {
  return review.kind === 'branch' && diff.kind === 'changeset' ? { kind: 'changeset', changesetId: diff.changesetId } : { kind: 'whole' };
}

/**
 * The view a thread was written in. Only a branch's review steps through changesets: a comment on any other review is
 * the whole review's, whatever changeset another client stored with it.
 */
export function writtenIn(review: CodeReviewTarget, thread: ReviewThread): ReviewDiffView {
  const { changesetId } = thread.root;
  return review.kind === 'branch' && changesetId !== undefined ? { kind: 'changeset', changesetId } : { kind: 'whole' };
}

/** The file a diff shows: its path (and where it moved from), and the revision on each side, -1 for a side it isn't on. */
export interface ShownFile {
  /** A repository path without its leading slash, as `DiffEntry.path`. */
  path: string;
  oldPath?: string;
  originalRevision: number;
  modifiedRevision: number;
}

export type LineAnchor = Extract<ReviewCommentAnchor, { kind: 'line' }>;
export type ImageAnchor = Extract<ReviewCommentAnchor, { kind: 'image' }>;
/** A thread on a file: its root comment is anchored to its lines, or to a spot of its image. */
export type FileThread = ReviewThread & { root: ReviewThread['root'] & { anchor: FileAnchor } };
/** A thread on a line: its root comment is anchored to one. */
export type LineThread = ReviewThread & { root: ReviewThread['root'] & { anchor: LineAnchor } };
/** A thread on a point or an area of an image. */
export type ImageThread = ReviewThread & { root: ReviewThread['root'] & { anchor: ImageAnchor } };

/** A side of a diff, as Pierre names them. */
export type ThreadSide = 'deletions' | 'additions';

/**
 * A thread at lines of the diff: its row goes under the last (`line`), as GitHub's do, and the lines from `firstLine`
 * are outlined; one line is `firstLine === line`. `earlier` when it was written on an earlier version and those lines
 * are unchanged since.
 */
export interface PlacedThread {
  thread: LineThread;
  side: ThreadSide;
  firstLine: number;
  line: number;
  earlier?: EarlierThread;
}

/** A thread written on a version of the file that neither side shows: an earlier one, its line read there. */
export interface EarlierThread {
  thread: LineThread;
  revisionId: number;
}

/** The threads of a file shown in a diff: those on a side's revision, at their line, and those on an earlier version. */
export interface FileThreads {
  placed: PlacedThread[];
  earlier: EarlierThread[];
}

/** A thread on a spot of an image a side of the diff shows. */
export interface PlacedImageThread {
  thread: ImageThread;
  side: ThreadSide;
  spot: ImageSpot;
}

/**
 * The threads on an image shown in a diff: those on a side's revision, at their spot, and those on an earlier version,
 * whose spot may show something else now.
 */
export interface ImageThreads {
  placed: PlacedImageThread[];
  earlier: { thread: ImageThread; revisionId: number }[];
}

/**
 * The threads a file's diff shows, in `view`:
 * - on a line of a revision either side shows, at that line: the newer side's, or the older one's (a file the review
 *   deletes is commented on its last revision, which its older side shows);
 * - on another revision of the file, an earlier one, to place by where its line went (`placeEarlier`).
 * A changeset's diff shows the threads written in it and those it settled (requests it applied, questions answered in
 * it), so the fix reads beside what asked for it; the whole review's those written in it, and those written
 * in one changeset's diff whose revision it shows or whose line it still has, so an open change
 * request never hides behind the mode it was written in.
 */
export function threadsOfFile(threads: readonly ReviewThread[], review: CodeReviewTarget, view: ReviewDiffView, file: ShownFile): FileThreads {
  const { onSides, earlier } = threadsOnRevisions(threads, review, view, file, isLineThread);
  return { placed: onSides.map(({ thread, side }) => ({ thread, side, firstLine: thread.root.anchor.firstLine, line: thread.root.anchor.lastLine })), earlier };
}

/** The threads on spots of an image a file's diff shows, in `view`, as `threadsOfFile` finds those on lines. */
export function imageThreadsOfFile(threads: readonly ReviewThread[], review: CodeReviewTarget, view: ReviewDiffView, file: ShownFile): ImageThreads {
  const { onSides, earlier } = threadsOnRevisions(threads, review, view, file, isImageThread);
  return { placed: onSides.map(({ thread, side }) => ({ thread, side, spot: thread.root.anchor.spot })), earlier };
}

/** A file's threads of one kind (`isKind`) in `view`: those on a revision either side shows, and the rest, earlier. */
function threadsOnRevisions<T extends FileThread>(
  threads: readonly ReviewThread[],
  review: CodeReviewTarget,
  view: ReviewDiffView,
  file: ShownFile,
  isKind: (thread: ReviewThread) => thread is T,
): { onSides: { thread: T; side: ThreadSide }[]; earlier: { thread: T; revisionId: number }[] } {
  const onSides: { thread: T; side: ThreadSide }[] = [];
  const earlier: { thread: T; revisionId: number }[] = [];
  for (const thread of threads) {
    if (!isKind(thread) || !isOfFile(thread.root.anchor, file)) continue;
    const written = writtenIn(review, thread);
    if (view.kind === 'changeset' && !belongsToChangeset(thread, written, view.changesetId)) continue;
    const { revisionId } = thread.root.anchor;
    if (revisionId === file.modifiedRevision) onSides.push({ thread, side: 'additions' });
    else if (revisionId === file.originalRevision) onSides.push({ thread, side: 'deletions' });
    else earlier.push({ thread, revisionId });
  }
  return { onSides, earlier };
}

/**
 * Whether a thread shows in a changeset's diff: written there, or settled by it, a change request it applied or a
 * question an answer says it fixed ("Fixed in cs:281301").
 */
function belongsToChangeset(thread: ReviewThread, written: ReviewDiffView, changesetId: number): boolean {
  return (written.kind === 'changeset' && written.changesetId === changesetId) || settledIn(thread, { kind: 'changeset', changesetId });
}

/** Whether `view` is the diff of the changeset that settled the thread: a request it applied, a question answered in it. */
export function settledIn(thread: ReviewThread, view: ReviewDiffView): boolean {
  if (view.kind !== 'changeset') return false;
  return (thread.state.kind === 'applied' || thread.state.kind === 'answered') && thread.state.changesetId === view.changesetId;
}

export function isLineThread(thread: ReviewThread): thread is LineThread {
  return thread.root.anchor.kind === 'line';
}

export function isImageThread(thread: ReviewThread): thread is ImageThread {
  return thread.root.anchor.kind === 'image';
}

/** Whether a thread is on a file, its lines or its image, rather than on the whole review. */
export function isFileThread(thread: ReviewThread): thread is FileThread {
  return thread.root.anchor.kind !== 'review';
}

/** The path a comment names, without its leading slash, as a diff names its files (`DiffEntry.path`). */
export function anchorPath(anchor: Pick<FileAnchor, 'path'>): string {
  return anchor.path.replace(/^\//, '');
}

/** Whether a comment is on the file: by its path then, the one it had, or the one it moved from. */
function isOfFile(anchor: FileAnchor, file: ShownFile): boolean {
  const path = anchorPath(anchor);
  return path === file.path || path === file.oldPath;
}

/**
 * A version's text: read, still being read (`undefined`), or not to be had (`null`: its read failed). A purged version
 * reads as an empty text (`PURGED_CONTENT`), whose lines are gone.
 */
export type VersionText = string | null | undefined;

/**
 * Where the threads on earlier versions go, once those versions are read (`textOf`): at their lines on a side where
 * they are unchanged since (`lineOf`), else outdated, shown apart with the line they were written on. While any
 * version is still read, every thread waits: rows are kept by their place (`annotationRowsOf`), so a thread placed
 * before another version arrives would be moved by it. One whose version's read failed is outdated, its line known
 * though not its text, and holds none of the others. A thread written in one changeset's diff, in the whole review's
 * diff, shows only where its line is still there: its own place is its changeset's diff.
 */
export function placeEarlier(
  earlier: readonly EarlierThread[],
  textOf: (revisionId: number) => VersionText,
  lineOf: (earlierText: string, thread: LineThread) => Pick<PlacedThread, 'side' | 'firstLine' | 'line'> | null,
  showsWhenOutdated: (thread: LineThread) => boolean,
): { placed: PlacedThread[]; outdated: EarlierThread[]; reading: EarlierThread[] } {
  const placed: PlacedThread[] = [];
  const outdated: EarlierThread[] = [];
  if (earlier.some((entry) => textOf(entry.revisionId) === undefined)) return { placed, outdated, reading: [...earlier] };
  for (const entry of earlier) {
    const text = textOf(entry.revisionId);
    const at = typeof text === 'string' ? lineOf(text, entry.thread) : null;
    if (at !== null) placed.push({ thread: entry.thread, ...at, earlier: entry });
    else if (showsWhenOutdated(entry.thread)) outdated.push(entry);
  }
  return { placed, outdated, reading: [] };
}

/** The earlier versions to read to place the threads on them, each once. */
export function earlierRevisions(earlier: readonly EarlierThread[]): number[] {
  return [...new Set(earlier.map((entry) => entry.revisionId))];
}
