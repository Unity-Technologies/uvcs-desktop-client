import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { spec } from '@shared/domain/specs';
import { writtenIn, type LineThread, type ReviewDiffView, type ThreadSide } from './fileThreads';

/**
 * The two ways "See in context" shows a thread written on an earlier version of a file: the diff it was written on, as
 * its author saw it (`commented`), and what was done to that version since (`since`).
 */
export type ContextView = 'commented' | 'since';

/** What a view compares, and where the thread sits in it. */
export interface ContextComparison {
  original: ContentSource;
  modified: ContentSource;
  side: ThreadSide;
  line: number;
}

/** The file as the diff it shows in names it: its revisions, its path, its repository. */
export type ShownEntry = Pick<DiffEntry, 'path' | 'oldPath' | 'baseRevisionId' | 'revisionId' | 'repository'>;

/**
 * The changeset whose diff to read to show a thread as it was written: the one it was written in, changeset by
 * changeset, when the diff on screen is another (the whole branch's); none when the diff on screen is the one it was
 * written in, whose older side is the one its author saw.
 */
export function writtenDiffToRead(review: CodeReviewTarget, thread: LineThread, view: ReviewDiffView): number | null {
  const written = writtenIn(review, thread);
  if (written.kind !== 'changeset') return null;
  return view.kind === 'changeset' && view.changesetId === written.changesetId ? null : written.changesetId;
}

/** The thread's file among the entries of the diff it was written in: by its path then, or the one it moved from. */
export function writtenEntryOf(entries: readonly ShownEntry[], thread: LineThread): ShownEntry | undefined {
  const path = threadPath(thread);
  return entries.find((entry) => entry.path === path || entry.oldPath === path);
}

/**
 * The diff a thread was written on: the older side of the diff it was written in (`writtenEntry`) against the version
 * commented on, the thread on its line on the newer side; on the older side for a comment on a file the diff deletes,
 * which `cm` places on its last revision.
 */
export function commentedComparison(thread: LineThread, writtenEntry: ShownEntry): ContextComparison {
  const { revisionId, line } = thread.root.anchor;
  const commented = revisionSource(revisionId, writtenEntry.repository, thread);
  if (writtenEntry.baseRevisionId === revisionId) return { original: commented, modified: { kind: 'empty' }, side: 'deletions', line };
  const before = writtenEntry.baseRevisionId === -1 ? EMPTY : revisionSource(writtenEntry.baseRevisionId, writtenEntry.repository, thread);
  return { original: before, modified: commented, side: 'additions', line };
}

/**
 * What was done to the version commented on: it against the file as the changeset that applied it left it, or, for
 * a thread not applied, the newest version the diff on screen shows (none when the diff deletes the file); the thread
 * on its line on the older side.
 */
export function sinceComparison(thread: LineThread, shown: ShownEntry): ContextComparison {
  const { revisionId, line, itemId } = thread.root.anchor;
  const original = revisionSource(revisionId, shown.repository, thread);
  const appliedIn = appliedChangeset(thread);
  const modified: ContentSource =
    appliedIn !== undefined
      ? { kind: 'spec', spec: spec.itemAt(itemId, spec.changeset(appliedIn), shown.repository), fileName: threadPath(thread) }
      : shown.revisionId === -1
        ? EMPTY
        : revisionSource(shown.revisionId, shown.repository, thread);
  return { original, modified, side: 'deletions', line };
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

const EMPTY: ContentSource = { kind: 'empty' };

function appliedChangeset(thread: LineThread): number | undefined {
  return thread.state.kind === 'applied' ? thread.state.changesetId : undefined;
}

function revisionSource(revisionId: number, repository: string, thread: LineThread): ContentSource {
  return { kind: 'revision', revision: { revisionId, repository }, fileName: threadPath(thread) };
}

function threadPath(thread: LineThread): string {
  return thread.root.anchor.path.replace(/^\//, '');
}
