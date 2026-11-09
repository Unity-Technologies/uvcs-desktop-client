import { comparePaths } from '@shared/pathOrder';
import { commentText } from '../../../lib/comments/commentText';
import { lowerCasedText } from '../../../lib/lowerCasedText';
import { matchesWordFilter, queryWords } from '../../../lib/matchesAllWords';
import { pluralize } from '../../../lib/text';
import { displayName } from '../../../lib/userName';
import type { DiffLayout } from '../../diff/viewer/diffPreferencesStore';
import type { ReviewThread } from '../conversation/reviewThreads';
import { locationText } from '../conversation/threadBadges';
import { anchorPath, isLineThread, type LineThread } from './fileThreads';

/** What the Comments panel lists: what's still open (change requests to apply, questions to answer), or every thread. */
export type CommentsFilter = 'open' | 'all';

/** A thread's kind, as the panel's kind chips find it. */
export type ThreadKind = 'changeRequest' | 'question' | 'comment';

/** The kind chips, in the order the panel shows them. */
export const THREAD_KINDS: readonly ThreadKind[] = ['changeRequest', 'question', 'comment'];

/** What the panel's filter row narrows the list to: words in what was said, and kinds (none chosen: every kind). */
export interface CommentsSearch {
  query: string;
  kinds: ReadonlySet<ThreadKind>;
}

export const NO_COMMENTS_SEARCH: CommentsSearch = { query: '', kinds: new Set() };

export function threadKindOf(thread: Pick<ReviewThread, 'root'>): ThreadKind {
  const { kind } = thread.root;
  return kind === 'changeRequest' || kind === 'question' ? kind : 'comment';
}

/**
 * Whether a thread shows under the filter row: of a kind chosen, if any is, and holding every word typed in what a
 * card can show: what was said in it, replies too, who said it, and its file.
 */
export function matchesCommentsSearch(thread: LineThread, { query, kinds }: CommentsSearch): boolean {
  if (kinds.size > 0 && !kinds.has(threadKindOf(thread))) return false;
  const comments = [thread.root, ...thread.replies];
  return matchesWordFilter([...comments.flatMap((comment) => [comment.text, comment.author, displayName(comment.author)]), anchorPath(thread.root.anchor)], query);
}

/** While searching, what a card says in place of its first words: who wrote the comment that matched, and its text from near the match. */
export interface MatchExcerpt {
  author: string;
  text: string;
}

/** How much of the text before the first match the excerpt keeps, so the match reads in its sentence. */
const EXCERPT_LEAD = 24;

/**
 * The comment of a thread the words typed were found in (the one holding most of them, the first of those), as one
 * line of its plain text starting a little before the first word found (cut at a word, "…" before it): a card shows a
 * thread's first words alone, and a match in a reply or further in would show nothing of why the card is listed. None
 * without words, or when they were found only in who said it or the file, which the card shows already.
 */
export function matchExcerpt(thread: Pick<LineThread, 'root' | 'replies'>, query: string): MatchExcerpt | null {
  const words = queryWords(query);
  if (words.length === 0) return null;
  let best: { author: string; text: string; found: number; at: number } | null = null;
  for (const comment of [thread.root, ...thread.replies]) {
    const text = commentText(comment.text).replace(/\s+/g, ' ').trim();
    const { lower, originalIndex } = lowerCasedText(text);
    const positions = words.map((word) => lower.indexOf(word)).filter((at) => at !== -1);
    if (positions.length > (best?.found ?? 0)) best = { author: comment.author, text, found: positions.length, at: originalIndex(Math.min(...positions)) };
  }
  if (!best) return null;
  return { author: best.author, text: excerptFrom(best.text, best.at) };
}

function excerptFrom(text: string, at: number): string {
  if (at <= EXCERPT_LEAD) return text;
  const space = text.indexOf(' ', at - EXCERPT_LEAD);
  const start = space === -1 || space >= at ? at : space + 1;
  return `…${text.slice(start)}`;
}

/** Whether the filter row narrows anything. */
export function isSearching({ query, kinds }: CommentsSearch): boolean {
  return query.trim() !== '' || kinds.size > 0;
}

/**
 * How the panel orders comments: as the code reads (by file, in the order the diff lists files, each file's by line),
 * grouped under their files; or by the latest comment or reply in each thread, newest or oldest first, one list.
 */
export type CommentsOrder = 'code' | 'newest' | 'oldest';

/** The orders, as the sort menu offers them. */
export const COMMENTS_ORDERS: readonly { value: CommentsOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'code', label: 'Code order' },
];

/** The sort button's tooltip: what it does, then the order chosen. */
export function commentsOrderTip(order: CommentsOrder): { tip: string; sub: string } {
  const sub = order === 'code' ? 'By file, then line' : 'By the latest comment or reply';
  return { tip: `Sort: ${COMMENTS_ORDERS.find((option) => option.value === order)!.label}`, sub };
}

/**
 * The threads on lines of code the panel lists, in the order chosen (`CommentsOrder`); in the same place or at the
 * same moment, as they were started.
 */
export function commentsPanelThreads(threads: readonly ReviewThread[], filter: CommentsFilter, search: CommentsSearch = NO_COMMENTS_SEARCH, order: CommentsOrder = 'code'): LineThread[] {
  const listed = threads.filter((thread): thread is LineThread => isLineThread(thread) && (filter === 'all' || thread.state.kind === 'open') && matchesCommentsSearch(thread, search));
  if (order === 'code') return listed.sort((a, b) => comparePaths(pathOf(a), pathOf(b)) || a.root.anchor.line - b.root.anchor.line || a.root.id - b.root.id);
  const latest = new Map(listed.map((thread) => [thread.root.id, latestActivity(thread)]));
  const direction = order === 'newest' ? -1 : 1;
  return listed.sort((a, b) => direction * (latest.get(a.root.id)! - latest.get(b.root.id)!) || a.root.id - b.root.id);
}

/** When a thread last moved: its latest comment or reply, as a time to compare. */
function latestActivity(thread: LineThread): number {
  return Math.max(...[thread.root, ...thread.replies].map((comment) => Date.parse(comment.date)));
}

function pathOf(thread: LineThread): string {
  return anchorPath(thread.root.anchor);
}

/** A file's comments in the code order, under its name and folder. */
export interface CommentsFileGroup {
  path: string;
  file: string;
  /** Where the file is, without the slashes around it: "src/client"; empty at the root. */
  folder: string;
  threads: LineThread[];
}

/**
 * The comments listed, under their files, in the code order: each file named once, not on every comment. None in a
 * time order, where comments of one file are apart.
 */
export function commentsByFile(listed: readonly LineThread[], order: CommentsOrder): CommentsFileGroup[] | null {
  if (order !== 'code') return null;
  const groups: CommentsFileGroup[] = [];
  for (const thread of listed) {
    const path = pathOf(thread);
    const last = groups.at(-1);
    if (last?.path === path) {
      last.threads.push(thread);
      continue;
    }
    const { folder, file } = locationText(thread.root.anchor);
    groups.push({ path, file, folder: folder.replace(/^\/+|\/+$/g, ''), threads: [thread] });
  }
  return groups;
}

/** How many threads on lines of code each filter lists. */
export function commentsPanelCounts(threads: readonly ReviewThread[]): Record<CommentsFilter, number> {
  const onLines = threads.filter(isLineThread);
  return { open: onLines.filter((thread) => thread.state.kind === 'open').length, all: onLines.length };
}

/** How many threads of each kind Open or All lists, for the kind chips. */
export function threadKindCounts(threads: readonly ReviewThread[], filter: CommentsFilter): Record<ThreadKind, number> {
  const counts: Record<ThreadKind, number> = { changeRequest: 0, question: 0, comment: 0 };
  for (const thread of commentsPanelThreads(threads, filter)) counts[threadKindOf(thread)] += 1;
  return counts;
}

/** What a kind chip is called, how many it finds in its tooltip. */
export function threadKindChipLabel(kind: ThreadKind, count: number): string {
  const names: Record<ThreadKind, string> = { changeRequest: 'Change requests', question: 'Questions', comment: 'Comments' };
  return `${names[kind]} (${count})`;
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

/**
 * Where the comment gone to is among those listed ("2 of 9"), or how many there are while none is; grouped by file,
 * in how many files too ("2 of 9 · 3 files").
 */
export function commentPosition(listed: readonly LineThread[], currentId: number | undefined, groups: readonly CommentsFileGroup[] | null = null): string {
  const index = listed.findIndex((thread) => thread.root.id === currentId);
  const position = index === -1 ? pluralize(listed.length, 'comment') : `${index + 1} of ${listed.length}`;
  return groups ? `${position} · ${pluralize(groups.length, 'file')}` : position;
}

/** Narrower than this, a diff's lines read as a strip of code: the Comments panel gives the room back. */
export const MIN_READABLE_DIFF_WIDTH = 480;

/**
 * Whether a review's Comments panel starts hidden as its changes first show: with no comments on its code it would
 * only say so, beside a diff it narrows; and where the code beside it would be narrower than `MIN_READABLE_DIFF_WIDTH`
 * (unified, a window of about 1000 px; side by side, each side, a window of about 1850 px), the markers on lines still
 * saying where comments are. Decided once, as the changes first show: a first comment, a window widened or the
 * layout switched doesn't open it. The user's own choice (`DetailsToggleButton`) is kept for the next review.
 */
export function commentsPanelStartsHidden({ codeThreads, diffWidth, layout }: { codeThreads: number; diffWidth: number; layout: DiffLayout }): boolean {
  const codeWidth = layout === 'split' ? diffWidth / 2 : diffWidth;
  return codeThreads === 0 || codeWidth < MIN_READABLE_DIFF_WIDTH;
}

/** The width a review's diff has beside its list of files and the Comments panel. */
export function diffWidthBesidePanel({ tabWidth, filesWidth, panelWidth }: { tabWidth: number; filesWidth: number; panelWidth: number }): number {
  return tabWidth - filesWidth - panelWidth;
}
