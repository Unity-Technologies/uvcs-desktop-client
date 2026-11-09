import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { spec } from '@shared/domain/specs';
import type { ReviewThread } from '../conversation/reviewThreads';
import { locationText } from '../conversation/threadBadges';
import { reviewDiffTarget } from '../reviewTarget';
import { anchorPath, writtenIn, type LineThread, type ReviewDiffView, type ThreadSide } from './fileThreads';

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

/**
 * Where a view finds the file's entry it compares from: the diff on screen's, a diff to read (the changeset the thread
 * was written in, or the review's whole diff, a read the Changes tab shares), or none (how a change request was
 * applied is read from the changeset that applied it).
 */
export type ContextEntry = { kind: 'onScreen' } | { kind: 'read'; target: DiffTarget } | { kind: 'none' };

export function contextEntryOf(review: CodeReviewTarget, thread: LineThread, view: ContextView, onScreen: Pick<OnScreen, 'view'> | null): ContextEntry {
  const whole = (): ContextEntry => {
    if (onScreen?.view.kind === 'whole') return { kind: 'onScreen' };
    const target = reviewDiffTarget(review);
    return target ? { kind: 'read', target } : { kind: 'none' };
  };
  if (view === 'since') return appliedChangeset(thread) !== undefined ? { kind: 'none' } : onScreen ? { kind: 'onScreen' } : whole();
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
 * What was done to the version commented on: it against the file as the changeset that applied it left it, or, for
 * a thread not applied, the newest version of the diff (`newest`; nothing when it deletes the file); the thread on its
 * line on the older side.
 */
export function sinceComparison(thread: LineThread, repository: string, newest: ShownEntry | null): ContextComparison {
  const { revisionId, line, itemId } = thread.root.anchor;
  const fileName = newest?.path ?? anchorPath(thread.root.anchor);
  const original = revisionSource(revisionId, repository, fileName);
  const appliedIn = appliedChangeset(thread);
  const modified: ContentSource =
    appliedIn !== undefined
      ? { kind: 'spec', spec: spec.itemAt(itemId, spec.changeset(appliedIn), repository), fileName: anchorPath(thread.root.anchor) }
      : newest
        ? newerSideOf(newest)
        : EMPTY;
  return { original, modified, side: 'deletions', line, fileName };
}

/**
 * What a view compares, once its file's entry is found (`contextEntryOf`): none to show a thread as written without
 * the diff it was written in (the file isn't in it, or the review's target is unknown).
 */
export function comparisonOf(thread: LineThread, view: ContextView, repository: string, entry: ShownEntry | null): ContextComparison | null {
  if (view === 'since') return sinceComparison(thread, repository, entry);
  return entry ? commentedComparison(thread, entry) : null;
}

/** The dialog's title: the file's name and the line the thread is on. */
export function contextTitle(thread: LineThread): string {
  return `${locationText(thread.root.anchor).file}, line ${thread.root.anchor.line}`;
}

/** What each view is called: the second says how a change request was applied, when it was. */
export function contextViewLabels(thread: LineThread): Record<ContextView, string> {
  return { commented: 'When commented', since: appliedChangeset(thread) === undefined ? 'Since then' : 'How it was applied' };
}

/** What a view shows, under the dialog's title: the line and what it's compared with. */
export function contextDescription(thread: LineThread, view: ContextView): string {
  const { line } = thread.root.anchor;
  if (view === 'commented') return `Line ${line} in the diff it was written on`;
  const appliedIn = appliedChangeset(thread);
  return appliedIn === undefined ? `Line ${line} as it was, against the newest version` : `Line ${line} as it was, against changeset ${appliedIn}, which applied it`;
}

/** The changeset that applied a change request; none for any other thread. */
export function appliedChangeset(thread: Pick<ReviewThread, 'state'>): number | undefined {
  return thread.state.kind === 'applied' ? thread.state.changesetId : undefined;
}

/**
 * The thread the dialog shows, as the conversation has it now: replies, edits and a discard made in the dialog show in
 * it; one deleted is gone.
 */
export type LiveThread = { kind: 'reading' } | { kind: 'thread'; thread: LineThread } | { kind: 'gone' };

export function liveThreadOf(threads: readonly ReviewThread[] | undefined, threadId: number): LiveThread {
  if (!threads) return { kind: 'reading' };
  const thread = threads.find((candidate) => candidate.root.id === threadId);
  return thread && thread.root.anchor.kind === 'line' ? { kind: 'thread', thread: thread as LineThread } : { kind: 'gone' };
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
