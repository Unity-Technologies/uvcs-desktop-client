import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { ReviewThread } from '../conversation/reviewThreads';
import { locationText } from '../conversation/threadBadges';
import { reviewDiffTarget } from '../reviewTarget';
import type { StepGroup } from '../rounds/reviewRounds';
import { anchorPath, isLineThread, writtenIn, type LineThread, type ReviewDiffView, type ThreadSide } from './fileThreads';

/**
 * The two ways "See in context" shows a thread: the diff it was written on, as its author saw it (`commented`), and
 * what was done to that version since (`since`): how the change request was applied, when it was.
 */
export type ContextView = 'commented' | 'since';

/** What a view compares, and where the thread sits in it. */
export interface ContextComparison {
  original: ContentSource;
  modified: ContentSource;
  side: ThreadSide;
  line: number;
  /** What the code is highlighted by. */
  fileName: string;
}

/** The file as a diff names it: its revisions, its path, its repository. */
export type ShownEntry = Pick<DiffEntry, 'path' | 'oldPath' | 'baseRevisionId' | 'revisionId' | 'repository'>;

/** The file's diff the dialog was opened from, and which of the review's diffs it is; none from elsewhere (the conversation). */
export interface OnScreen {
  view: ReviewDiffView;
  entry: ShownEntry;
}

/** How a thread opens in context: on which view, and from which file's diff (none from the conversation or the panel). */
export interface ContextRequest {
  startsOn?: ContextView;
  onScreen?: OnScreen;
  /**
   * What "How it was applied" steps through, as the view it opens from shows the threads: the conversation's kept
   * layout (`useConversationLayout`). None steps through them as a fresh read places them (`stepGroupsOf`).
   */
  steps?: readonly StepGroup[];
}

/**
 * Where a view finds the file's entry it compares from: the diff on screen's, or a diff to read (the changeset the
 * thread was written in, the changeset that applied it, or the review's whole diff, a read the Changes tab shares);
 * none on a review whose target is unknown.
 */
export type ContextEntry = { kind: 'onScreen' } | { kind: 'read'; target: DiffTarget } | { kind: 'none' };

export function contextEntryOf(review: CodeReviewTarget, thread: LineThread, view: ContextView, onScreen: Pick<OnScreen, 'view'> | null): ContextEntry {
  const whole = (): ContextEntry => {
    if (onScreen?.view.kind === 'whole') return { kind: 'onScreen' };
    const target = reviewDiffTarget(review);
    return target ? { kind: 'read', target } : { kind: 'none' };
  };
  // Applied, what the changeset that applied it did to the file; else what it became in the review's newest version:
  // the whole review's diff's, never a changeset's.
  if (view === 'since') {
    const appliedIn = settlingChangeset(thread);
    return appliedIn !== undefined ? { kind: 'read', target: { kind: 'changeset', changesetId: appliedIn } } : whole();
  }
  const written = writtenIn(review, thread);
  if (written.kind === 'whole') return whole();
  if (onScreen?.view.kind === 'changeset' && onScreen.view.changesetId === written.changesetId) return { kind: 'onScreen' };
  return { kind: 'read', target: { kind: 'changeset', changesetId: written.changesetId } };
}

/** The thread's file among the entries of a diff: by its path then, or the one it moved from. */
export function entryOfThread(entries: readonly ShownEntry[], thread: LineThread): ShownEntry | undefined {
  const path = anchorPath(thread.root.anchor);
  return entries.find((entry) => entry.path === path || entry.oldPath === path);
}

/**
 * The diff a thread was written on: the older side of the diff it was written in (`written`) against the version
 * commented on, the thread under its line on the newer side; a comment on a removed line (the older side's revision)
 * stays on that side, against the diff's newer side, or nothing for a file the diff deletes.
 */
export function commentedComparison(thread: LineThread, written: ShownEntry): ContextComparison {
  const { revisionId, line } = thread.root.anchor;
  const fileName = written.path;
  if (written.baseRevisionId === revisionId) return { original: olderSideOf(written), modified: newerSideOf(written), side: 'deletions', line, fileName };
  const commented = revisionSource(revisionId, written.repository, written.path);
  return { original: olderSideOf(written), modified: commented, side: 'additions', line, fileName };
}

/**
 * What was done to the version commented on, for a thread not applied: it against the review's newest version
 * (`newest`; nothing when the review deletes the file), the thread on its line on the older side.
 */
export function sinceComparison(thread: LineThread, repository: string, newest: ShownEntry | null): ContextComparison {
  const { revisionId, line } = thread.root.anchor;
  const fileName = newest?.path ?? anchorPath(thread.root.anchor);
  const original = revisionSource(revisionId, repository, fileName);
  return { original, modified: newest ? newerSideOf(newest) : EMPTY, side: 'deletions', line, fileName };
}

/**
 * How a change request was applied, from the file's entry in the diff of the changeset that applied it (`applied`):
 * the version commented on against what that changeset left, the thread on the older side; that changeset's own diff
 * when the comment is on the version it made, the thread on the newer side. None when it didn't change the file (the
 * request marked applied by hand, `contextMissingText`).
 */
export function appliedComparison(thread: LineThread, applied: ShownEntry | null): ContextComparison | null {
  if (!applied) return null;
  const { revisionId, line } = thread.root.anchor;
  const fileName = applied.path;
  if (applied.revisionId === revisionId) return { original: olderSideOf(applied), modified: newerSideOf(applied), side: 'additions', line, fileName };
  return { original: revisionSource(revisionId, applied.repository, fileName), modified: newerSideOf(applied), side: 'deletions', line, fileName };
}

/**
 * What a view compares, once its file's entry is found (`contextEntryOf`): none without the diff it needs (the file
 * isn't in it, or the review's target is unknown).
 */
export function comparisonOf(thread: LineThread, view: ContextView, repository: string, entry: ShownEntry | null): ContextComparison | null {
  if (view === 'commented') return entry ? commentedComparison(thread, entry) : null;
  return settlingChangeset(thread) === undefined ? sinceComparison(thread, repository, entry) : appliedComparison(thread, entry);
}

/** What a view says when it has nothing to compare (`comparisonOf`). */
export function contextMissingText(thread: LineThread, view: ContextView): string {
  const appliedIn = settlingChangeset(thread);
  return view === 'since' && appliedIn !== undefined ? `Changeset ${appliedIn} didn't change this file` : "Couldn't find the diff it was written on";
}

/** The dialog's title: the file's name and the line the thread is on. */
export function contextTitle(thread: LineThread): string {
  return `${locationText(thread.root.anchor).file}, line ${thread.root.anchor.line}`;
}

/** What each view is called: the second says how a change request was applied, or a question answered, when it was. */
export function contextViewLabels(thread: LineThread): Record<ContextView, string> {
  if (settlingChangeset(thread) === undefined) return { commented: 'When commented', since: 'Since then' };
  return { commented: 'When commented', since: thread.state.kind === 'answered' ? 'How it was answered' : 'How it was applied' };
}

/**
 * What a view shows, under the dialog's title: the line and what it's compared with. A request marked applied in a
 * changeset that didn't change its file (`fileInChangeset` false) is said to be marked so: nothing there applied it.
 */
export function contextDescription(thread: LineThread, view: ContextView, { fileInChangeset = true }: { fileInChangeset?: boolean } = {}): string {
  const { line } = thread.root.anchor;
  if (view === 'commented') return `Line ${line} in the diff it was written on`;
  const appliedIn = settlingChangeset(thread);
  if (appliedIn === undefined) return `Line ${line} as it was, against the newest version`;
  if (thread.state.kind === 'answered') return `Line ${line} as it was, against changeset ${appliedIn}, which answered it`;
  return fileInChangeset ? `Line ${line} as it was, against changeset ${appliedIn}, which applied it` : `Line ${line}, marked applied in changeset ${appliedIn}`;
}

/**
 * The changeset that settled a thread, which "How it was applied" compares the commented version with: the one that
 * applied a change request, or the one an answer names ("Fixed in cs:281301"); none for any other thread.
 */
export function settlingChangeset(thread: Pick<ReviewThread, 'state'>): number | undefined {
  return thread.state.kind === 'applied' || thread.state.kind === 'answered' ? thread.state.changesetId : undefined;
}

/**
 * The thread the dialog shows, as the conversation has it now: replies, edits and a discard made in the dialog show in
 * it; one deleted is gone.
 */
export type LiveThread = { kind: 'reading' } | { kind: 'thread'; thread: LineThread } | { kind: 'gone' };

export function liveThreadOf(threads: readonly ReviewThread[] | undefined, threadId: number): LiveThread {
  if (!threads) return { kind: 'reading' };
  const thread = threads.find((candidate) => candidate.root.id === threadId);
  return thread && isLineThread(thread) ? { kind: 'thread', thread } : { kind: 'gone' };
}

const EMPTY: ContentSource = { kind: 'empty' };

// Named as the diff names its sides (`diffEntrySources`), so a version it already read is read once.
function olderSideOf(entry: ShownEntry): ContentSource {
  return entry.baseRevisionId === -1 ? EMPTY : revisionSource(entry.baseRevisionId, entry.repository, entry.oldPath ?? entry.path);
}

function newerSideOf(entry: ShownEntry): ContentSource {
  return entry.revisionId === -1 ? EMPTY : revisionSource(entry.revisionId, entry.repository, entry.path);
}

function revisionSource(revisionId: number, repository: string, fileName: string): ContentSource {
  return { kind: 'revision', revision: { revisionId, repository }, fileName };
}
