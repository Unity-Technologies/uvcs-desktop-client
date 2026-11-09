import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { DiffTarget } from '@shared/domain/diff';
import type { ReviewCommentAnchor } from '@shared/domain/reviewConversation';
import type { ReviewThread } from '../conversation/reviewThreads';

/**
 * Which of a review's diffs the Changes tab shows: the whole review's (a branch's "Whole branch", a changeset's, a
 * shelve's) or one changeset of a branch, stepped to in "Changeset by changeset". A comment belongs to the one it was
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
/** A thread on a line: its root comment is anchored to one. */
export type LineThread = ReviewThread & { root: ReviewThread['root'] & { anchor: LineAnchor } };

/** A side of a diff, as Pierre names them. */
export type ThreadSide = 'deletions' | 'additions';

/** A thread at a line of the diff. `earlier` when it was written on an earlier version and that line is unchanged since. */
export interface PlacedThread {
  thread: LineThread;
  side: ThreadSide;
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

/**
 * The threads a file's diff shows, in `view`:
 * - on a line of a revision either side shows, at that line: the newer side's, or the older one's (a file the review
 *   deletes is commented on its last revision, which its older side shows);
 * - on another revision of the file, an earlier one, to place by where its line went (`placeEarlier`).
 * A changeset's diff shows the threads written in it; the whole review's those written in it, and those written
 * changeset by changeset whose revision it shows or whose line it still has, so an open change
 * request never hides behind the mode it was written in.
 */
export function threadsOfFile(threads: readonly ReviewThread[], review: CodeReviewTarget, view: ReviewDiffView, file: ShownFile): FileThreads {
  const placed: PlacedThread[] = [];
  const earlier: EarlierThread[] = [];
  for (const thread of threads) {
    if (!isLineThread(thread) || !isOfFile(thread.root.anchor, file)) continue;
    const written = writtenIn(review, thread);
    if (view.kind === 'changeset' && (written.kind !== 'changeset' || written.changesetId !== view.changesetId)) continue;
    const { revisionId, line } = thread.root.anchor;
    if (revisionId === file.modifiedRevision) placed.push({ thread, side: 'additions', line });
    else if (revisionId === file.originalRevision) placed.push({ thread, side: 'deletions', line });
    else earlier.push({ thread, revisionId });
  }
  return { placed, earlier };
}

export function isLineThread(thread: ReviewThread): thread is LineThread {
  return thread.root.anchor.kind === 'line';
}

/** The path a comment names, without its leading slash, as a diff names its files (`DiffEntry.path`). */
export function anchorPath(anchor: Pick<LineAnchor, 'path'>): string {
  return anchor.path.replace(/^\//, '');
}

/** Whether a comment is on the file: by its path then, the one it had, or the one it moved from. */
function isOfFile(anchor: LineAnchor, file: ShownFile): boolean {
  const path = anchorPath(anchor);
  return path === file.path || path === file.oldPath;
}

/**
 * A version's text: read, still being read (`undefined`), or not to be had (`null`: its read failed). A purged version
 * reads as an empty text (`PURGED_CONTENT`), whose lines are gone.
 */
export type VersionText = string | null | undefined;

/**
 * Where the threads on earlier versions go, once those versions are read (`textOf`): at their line on the newer side
 * when it is unchanged since (`lineOf`), else outdated, shown apart with the line they were written on. While any
 * version is still read, every thread waits: rows are kept by their place (`annotationRowsOf`), so a thread placed
 * before another version arrives would be moved by it. One whose version's read failed is outdated, its line known
 * though not its text, and holds none of the others. A thread written changeset by changeset, in the whole review's diff, shows only where its
 * line is still there: its own place is its changeset's diff.
 */
export function placeEarlier(
  earlier: readonly EarlierThread[],
  textOf: (revisionId: number) => VersionText,
  lineOf: (earlierText: string, line: number) => number | null,
  showsWhenOutdated: (thread: LineThread) => boolean,
): { placed: PlacedThread[]; outdated: EarlierThread[]; reading: EarlierThread[] } {
  const placed: PlacedThread[] = [];
  const outdated: EarlierThread[] = [];
  if (earlier.some((entry) => textOf(entry.revisionId) === undefined)) return { placed, outdated, reading: [...earlier] };
  for (const entry of earlier) {
    const text = textOf(entry.revisionId);
    const line = typeof text === 'string' ? lineOf(text, entry.thread.root.anchor.line) : null;
    if (line !== null) placed.push({ thread: entry.thread, side: 'additions', line, earlier: entry });
    else if (showsWhenOutdated(entry.thread)) outdated.push(entry);
  }
  return { placed, outdated, reading: [] };
}

/** The earlier versions to read to place the threads on them, each once. */
export function earlierRevisions(earlier: readonly EarlierThread[]): number[] {
  return [...new Set(earlier.map((entry) => entry.revisionId))];
}
