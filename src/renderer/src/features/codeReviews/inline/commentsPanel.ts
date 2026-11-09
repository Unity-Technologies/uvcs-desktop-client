import { comparePaths } from '@shared/pathOrder';
import { pluralize } from '../../../lib/text';
import type { ReviewThread } from '../conversation/reviewThreads';
import { anchorPath, isLineThread, type LineThread } from './fileThreads';

/** What the Comments panel lists: what's still open (change requests to apply, questions to answer), or every thread. */
export type CommentsFilter = 'open' | 'all';

/**
 * The threads on lines of code the panel lists: by file, in the order the diff lists files, each file's by line, then
 * as they were started.
 */
export function commentsPanelThreads(threads: readonly ReviewThread[], filter: CommentsFilter): LineThread[] {
  const listed = threads.filter((thread): thread is LineThread => isLineThread(thread) && (filter === 'all' || thread.state.kind === 'open'));
  return listed.sort((a, b) => comparePaths(pathOf(a), pathOf(b)) || a.root.anchor.line - b.root.anchor.line || a.root.id - b.root.id);
}

function pathOf(thread: LineThread): string {
  return anchorPath(thread.root.anchor);
}

/** How many threads on lines of code each filter lists. */
export function commentsPanelCounts(threads: readonly ReviewThread[]): Record<CommentsFilter, number> {
  const onLines = threads.filter(isLineThread);
  return { open: onLines.filter((thread) => thread.state.kind === 'open').length, all: onLines.length };
}

/** The panel opens on what's still open, when anything is; else on everything said. */
export function initialCommentsFilter(threads: readonly ReviewThread[]): CommentsFilter {
  return commentsPanelCounts(threads).open > 0 ? 'open' : 'all';
}

/** What the panel says when its filter lists nothing. */
export function emptyCommentsText(filter: CommentsFilter, counts: Record<CommentsFilter, number>): { title: string; description?: string } {
  if (counts.all === 0) return { title: 'No comments on the code yet' };
  return filter === 'open' ? { title: 'Nothing left to answer', description: 'Every change request is applied or discarded, and every question answered.' } : { title: 'No comments on the code yet' };
}

/**
 * The comment after or before the one gone to (`direction` 1 or -1), in the order the panel lists them (`listed`,
 * across files); none past either end. One that left the list (settled while Open lists) goes on from where it sat in
 * every comment's order (`all`); from none, the first or the last.
 */
export function steppedThread(listed: readonly LineThread[], all: readonly LineThread[], currentId: number | undefined, direction: 1 | -1): LineThread | null {
  const index = listed.findIndex((thread) => thread.root.id === currentId);
  if (index !== -1) return listed[index + direction] ?? null;
  const at = all.findIndex((thread) => thread.root.id === currentId);
  if (at === -1) return (direction === 1 ? listed[0] : listed.at(-1)) ?? null;
  const shown = new Set(listed.map((thread) => thread.root.id));
  const onward = direction === 1 ? all.slice(at + 1) : all.slice(0, at).reverse();
  return onward.find((thread) => shown.has(thread.root.id)) ?? null;
}

/**
 * The filter the panel shows: the one picked, else the one it opened on (`initialCommentsFilter`, at the first read),
 * kept as threads settle: Open stays Open, "Nothing left to answer", once the last is answered.
 */
export function shownCommentsFilter(picked: CommentsFilter | null, openedOn: CommentsFilter | null): CommentsFilter {
  return picked ?? openedOn ?? 'all';
}

/** Where the comment gone to is among those listed ("2 of 9"), or how many there are while none is. */
export function commentPosition(listed: readonly LineThread[], currentId: number | undefined): string {
  const index = listed.findIndex((thread) => thread.root.id === currentId);
  return index === -1 ? pluralize(listed.length, 'comment') : `${index + 1} of ${listed.length}`;
}
