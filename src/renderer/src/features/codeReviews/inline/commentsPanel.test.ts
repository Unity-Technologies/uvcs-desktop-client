import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread } from './fileThreads';
import {
  MIN_READABLE_DIFF_WIDTH,
  diffWidthBesidePanel,
  commentsPanelStartsHidden,
  commentPosition,
  commentsFilterChoices,
  commentsPanelCounts,
  commentsByFile,
  commentsOrderTip,
  foldAllEntry,
  NO_COMMENTS_SEARCH,
  shownFolds,
  NO_FOLDED_FILES,
  toggledFold,
  unfoldedFor,
  knownCommentsOrder,
  commentsPanelThreads,
  emptyCommentsText,
  initialCommentsFilter,
  isSearching,
  matchExcerpt,
  shownCommentsFilter,
  steppedThread,
  threadKindChipLabel,
  threadKindCounts,
  threadKindOf,
  type CommentsSearch,
} from './commentsPanel';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`, text: '', kind: 'changeRequest', anchor: { kind: 'review' }, ...fields };
}

const onLine = (id: number, path: string, line: number, fields: Partial<ReviewComment> = {}) => comment(id, { anchor: { kind: 'line', revisionId: 1, itemId: 1, path, line }, ...fields });

const THREADS = threadsOf([
  comment(1, { kind: 'general' }),
  onLine(2, '/src/b.cs', 30),
  onLine(3, '/src/b.cs', 4, { kind: 'question' }),
  onLine(4, '/a.cs', 9, { appliedInChangeset: 12 }),
  onLine(5, '/src/b.cs', 4, { kind: 'comment' }),
  comment(6, { parentId: 3, kind: 'comment' }),
]);

describe('commentsPanelThreads', () => {
  it('lists every thread on a line, files as the diff lists them, each by line', () => {
    expect(commentsPanelThreads(THREADS, 'all').map((thread) => thread.root.id)).toEqual([4, 3, 5, 2]);
  });

  it('lists only what is still open', () => {
    expect(commentsPanelThreads(THREADS, 'open').map((thread) => thread.root.id)).toEqual([2]);
  });

  // Thread 3 was answered last (reply 6), after 5 and 4 were written; 2 is the oldest.
  it('lists newest first by the latest comment or reply in each thread, a reply bringing an old thread up', () => {
    expect(commentsPanelThreads(THREADS, 'all', undefined, 'newest').map((thread) => thread.root.id)).toEqual([3, 5, 4, 2]);
  });

  it('lists oldest first by the same latest comment or reply', () => {
    expect(commentsPanelThreads(THREADS, 'all', undefined, 'oldest').map((thread) => thread.root.id)).toEqual([2, 4, 5, 3]);
  });

  it('orders by when, not by which was written first: a thread started later can have moved earlier', () => {
    const early = '2026-11-06T09:00:00Z';
    const late = '2026-11-06T11:00:00Z';
    const byDate = threadsOf([onLine(1, '/a.cs', 1, { date: late }), onLine(2, '/a.cs', 2, { date: early })]);
    expect(commentsPanelThreads(byDate, 'all', undefined, 'newest').map((thread) => thread.root.id)).toEqual([1, 2]);
    expect(commentsPanelThreads(byDate, 'all', undefined, 'oldest').map((thread) => thread.root.id)).toEqual([2, 1]);
  });

  it('lists threads that last moved at the same moment as they were started, in either direction', () => {
    const date = '2026-11-06T10:00:00Z';
    const sameTime = threadsOf([onLine(8, '/a.cs', 1, { date }), onLine(7, '/b.cs', 1, { date })]);
    expect(commentsPanelThreads(sameTime, 'all', undefined, 'newest').map((thread) => thread.root.id)).toEqual([7, 8]);
    expect(commentsPanelThreads(sameTime, 'all', undefined, 'oldest').map((thread) => thread.root.id)).toEqual([7, 8]);
  });
});

describe('commentsByFile', () => {
  it('groups the code order under each file, named once, in the order listed', () => {
    const groups = commentsByFile(commentsPanelThreads(THREADS, 'all'), 'code');
    expect(groups?.map(({ path, folder, file, threads }) => ({ path, folder, file, ids: threads.map((thread) => thread.root.id) }))).toEqual([
      { path: 'a.cs', folder: '', file: 'a.cs', ids: [4] },
      { path: 'src/b.cs', folder: 'src', file: 'b.cs', ids: [3, 5, 2] },
    ]);
  });

  it('names a deep folder without the slashes around it', () => {
    const deep = threadsOf([onLine(1, '/01plastic/bin/client/localization/cm-help.en.txt', 1790)]);
    expect(commentsByFile(commentsPanelThreads(deep, 'all'), 'code')?.[0]).toMatchObject({ folder: '01plastic/bin/client/localization', file: 'cm-help.en.txt' });
  });

  it('groups nothing in a time order, where one file\'s comments are apart', () => {
    expect(commentsByFile(commentsPanelThreads(THREADS, 'all', undefined, 'newest'), 'newest')).toBeNull();
    expect(commentsByFile(commentsPanelThreads(THREADS, 'all', undefined, 'oldest'), 'oldest')).toBeNull();
  });

  it('has no group with nothing listed', () => {
    expect(commentsByFile([], 'code')).toEqual([]);
  });
});

describe('folding files', () => {
  const groups = commentsByFile(commentsPanelThreads(THREADS, 'all'), 'code');

  it('folds a file and unfolds it again, its name clicked', () => {
    const folded = toggledFold(NO_FOLDED_FILES, 'src/b.cs');
    expect([...folded]).toEqual(['src/b.cs']);
    expect([...toggledFold(folded, 'src/b.cs')]).toEqual([]);
  });

  it('unfolds the file a comment gone to is grouped under, and changes nothing when it was open', () => {
    const [onA, onB] = groups!;
    const folded = new Set([onA!.path, onB!.path]);
    expect([...unfoldedFor(folded, onB!.threads[0]!)]).toEqual([onA!.path]);
    expect(unfoldedFor(new Set([onA!.path]), onB!.threads[0]!)).toEqual(new Set([onA!.path]));
    const open = new Set<string>();
    expect(unfoldedFor(open, onA!.threads[0]!)).toBe(open);
  });

  it('shows every file unfolded while searching, so a match in a folded one shows why it is listed', () => {
    const folded = new Set(['a.cs']);
    expect(shownFolds(folded, { query: 'shelve', kinds: new Set() })).toEqual(NO_FOLDED_FILES);
    expect(shownFolds(folded, { query: '', kinds: new Set(['question']) })).toEqual(NO_FOLDED_FILES);
    expect(shownFolds(folded, NO_COMMENTS_SEARCH)).toBe(folded);
  });

  it('keeps folded what the filter hides now, collapsing all', () => {
    expect(foldAllEntry(groups, new Set(['gone.cs']))?.folded).toEqual(new Set(['gone.cs', 'a.cs', 'src/b.cs']));
  });

  it('collapses every file while any is open, and expands them all once none is', () => {
    expect(foldAllEntry(groups, new Set(['a.cs']))).toEqual({ label: 'Collapse all', collapses: true, folded: new Set(['a.cs', 'src/b.cs']) });
    expect(foldAllEntry(groups, new Set(['a.cs', 'src/b.cs']))).toEqual({ label: 'Expand all', collapses: false, folded: NO_FOLDED_FILES });
  });

  it('offers no folding in a time order, nor with nothing listed', () => {
    expect(foldAllEntry(null, NO_FOLDED_FILES)).toBeNull();
    expect(foldAllEntry([], NO_FOLDED_FILES)).toBeNull();
  });
});

describe('knownCommentsOrder', () => {
  it('keeps an order this version knows, and falls back to the code order for any other', () => {
    expect(knownCommentsOrder('newest')).toBe('newest');
    expect(knownCommentsOrder('byAuthor')).toBe('code');
    expect(knownCommentsOrder(undefined)).toBe('code');
  });
});

describe('commentsOrderTip', () => {
  it('names the order chosen, and what it sorts by', () => {
    expect(commentsOrderTip('code')).toEqual({ tip: 'Sort: Code order', sub: 'By file, then line' });
    expect(commentsOrderTip('newest')).toEqual({ tip: 'Sort: Newest first', sub: 'By the latest comment or reply' });
  });
});

describe('the filter row', () => {
  const words = threadsOf([
    onLine(1, '/src/Player.cs', 1, { text: 'Rename the field', author: 'ana' }),
    onLine(2, '/src/Enemy.cs', 2, { kind: 'question', text: 'Why a loop?', author: 'luis@unity3d.com' }),
    comment(3, { parentId: 2, kind: 'comment', text: 'It reads better', author: 'ana' }),
    onLine(4, '/src/Enemy.cs', 9, { kind: 'comment', text: 'Nice ÑANDÚ fix' }),
  ]);
  const search = (query: string, kinds: CommentsSearch['kinds'] = new Set()) => commentsPanelThreads(words, 'all', { query, kinds }).map((thread) => thread.root.id);

  it('finds threads by every word typed, in what was said, replies too, in any case', () => {
    expect(search('rename FIELD')).toEqual([1]);
    expect(search('reads better')).toEqual([2]);
    expect(search('ñandú')).toEqual([4]);
    expect(search('rename loop')).toEqual([]);
  });

  it('finds them by who said them and by their file', () => {
    expect(search('luis')).toEqual([2]);
    expect(search('player')).toEqual([1]);
  });

  it('keeps only the kinds chosen, with the words', () => {
    expect(search('', new Set(['question', 'comment']))).toEqual([2, 4]);
    expect(search('loop', new Set(['changeRequest']))).toEqual([]);
  });

  it('counts each kind Open or All lists', () => {
    expect(threadKindCounts(words, 'all')).toEqual({ changeRequest: 1, question: 1, comment: 1 });
    expect(threadKindCounts(words, 'open')).toEqual({ changeRequest: 1, question: 0, comment: 0 });
  });

  it('names a chip with its count, and knows a comment of any other kind as a comment', () => {
    expect(threadKindChipLabel('changeRequest', 3)).toBe('Change requests (3)');
    expect(threadKindOf({ root: comment(9, { kind: 'general' }) })).toBe('comment');
  });

  it('narrows the list only with words or kinds', () => {
    expect(isSearching({ query: ' ', kinds: new Set() })).toBe(false);
    expect(isSearching({ query: 'a', kinds: new Set() })).toBe(true);
    expect(isSearching({ query: '', kinds: new Set(['question']) })).toBe(true);
  });
});

describe('matchExcerpt', () => {
  const [thread] = threadsOf([
    onLine(1, '/src/Player.cs', 1, { text: 'Fix the release notes:\n\n- They must say that a bare **--re-request** needs --all', author: 'miryam' }),
    comment(2, { parentId: 1, kind: 'comment', text: 'Fixed in the releasenotes attribute', author: 'dani' }),
  ]) as [LineThread];

  it('shows the reply the words were found in, with who wrote it', () => {
    expect(matchExcerpt(thread, 'attribute')).toEqual({ author: 'dani', text: '…in the releasenotes attribute' });
  });

  it('starts a little before a match far into a comment, at a word, as plain text', () => {
    expect(matchExcerpt(thread, 'needs')).toEqual({ author: 'miryam', text: '…a bare --re-request needs --all' });
  });

  it('keeps a comment whose match is near its start whole', () => {
    expect(matchExcerpt(thread, 'release')).toEqual({ author: 'miryam', text: 'Fix the release notes: • They must say that a bare --re-request needs --all' });
  });

  it('starts at the match in a text whose letters grow when lower-cased, as a Turkish İ does', () => {
    const [turkish] = threadsOf([onLine(1, '/src/City.cs', 1, { text: 'İSTANBUL İZMİR İÇEL İNEBOLU İĞDIR names the cities; rename them' })]) as [LineThread];

    expect(matchExcerpt(turkish, 'rename')).toEqual({ author: 'ana', text: '…names the cities; rename them' });
  });

  it('finds a word as it is typed in any script, a Greek one ending in Σ too', () => {
    const [greek] = threadsOf([onLine(1, '/src/Street.cs', 1, { text: 'ΟΔΟΣ is the street' })]) as [LineThread];

    expect(matchExcerpt(greek, 'ΟΔΟΣ')).toEqual({ author: 'ana', text: 'ΟΔΟΣ is the street' });
  });

  it('picks the comment holding most of the words', () => {
    expect(matchExcerpt(thread, 'fixed attribute notes')?.author).toBe('dani');
  });

  it('is none without words, or when they were found only in who wrote it or the file', () => {
    expect(matchExcerpt(thread, ' ')).toBeNull();
    expect(matchExcerpt(thread, 'player')).toBeNull();
  });
});

describe('commentsPanelCounts', () => {
  it('counts the threads on lines, and the open ones; the comments on the whole review are not on the code', () => {
    expect(commentsPanelCounts(THREADS)).toEqual({ open: 1, new: 0, all: 4 });
  });
});

describe('initialCommentsFilter', () => {
  it('opens on what is open when anything is, else on everything', () => {
    expect(initialCommentsFilter(THREADS)).toBe('open');
    expect(initialCommentsFilter(threadsOf([onLine(1, '/a.cs', 1, { kind: 'comment' })]))).toBe('all');
  });
});

describe('emptyCommentsText', () => {
  it('tells a review with no comments on its code from one with nothing left to answer', () => {
    expect(emptyCommentsText('all', { open: 0, new: 0, all: 0 }).title).toBe('No comments on the code yet');
    expect(emptyCommentsText('open', { open: 0, new: 0, all: 3 }).title).toBe('Nothing left to answer');
  });
});

describe('steppedThread', () => {
  const listed = commentsPanelThreads(THREADS, 'all');
  const ids = listed.map((thread) => thread.root.id);
  const step = (current: number | undefined, direction: 1 | -1, among = listed) => steppedThread(among, listed, current, direction)?.root.id ?? null;

  it('goes to the next or previous comment in the order the panel lists them, across files', () => {
    expect(step(ids[0], 1)).toBe(ids[1]);
    expect(step(ids[2], -1)).toBe(ids[1]);
  });

  it('starts at the first or the last when none is gone to yet', () => {
    expect(step(undefined, 1)).toBe(ids[0]);
    expect(step(undefined, -1)).toBe(ids.at(-1));
    expect(step(99, 1)).toBe(ids[0]);
  });

  it('goes on from where the one gone to sat once it left the list (settled under Open), not back to the first', () => {
    const withoutSecond = listed.filter((thread) => thread.root.id !== ids[1]);
    expect(step(ids[1], 1, withoutSecond)).toBe(ids[2]);
    expect(step(ids[1], -1, withoutSecond)).toBe(ids[0]);
  });

  it('stops at either end, and has nowhere to go in an empty list', () => {
    expect(step(ids.at(-1), 1)).toBeNull();
    expect(step(ids[0], -1)).toBeNull();
    expect(step(undefined, 1, [])).toBeNull();
  });
});

describe('commentPosition', () => {
  const listed = commentsPanelThreads(THREADS, 'all');

  it('says where the comment gone to is among those listed, and how many there are when none is', () => {
    expect(commentPosition(listed, listed[1]!.root.id)).toBe(`2 of ${listed.length}`);
    expect(commentPosition(listed, undefined)).toBe(`${listed.length} comments`);
    expect(commentPosition(listed.slice(0, 1), undefined)).toBe('1 comment');
  });

  it('says in how many files too, grouped by file', () => {
    const groups = commentsByFile(listed, 'code');
    expect(commentPosition(listed, listed[1]!.root.id, groups)).toBe(`2 of ${listed.length} · 2 files`);
    expect(commentPosition(listed.slice(0, 1), undefined, groups?.slice(0, 1))).toBe('1 comment · 1 file');
  });
});

describe('shownCommentsFilter', () => {
  it('keeps the filter the panel opened on as threads settle, until one is picked', () => {
    expect(shownCommentsFilter(null, 'open')).toBe('open');
    expect(shownCommentsFilter('all', 'open')).toBe('all');
    expect(shownCommentsFilter(null, null)).toBe('all');
  });
});

describe('commentsPanelStartsHidden', () => {
  it('starts hidden on a review with no comments on its code, which it would only say', () => {
    expect(commentsPanelStartsHidden({ codeThreads: 0, diffWidth: 1200, layout: 'unified' })).toBe(true);
    expect(commentsPanelStartsHidden({ codeThreads: 1, diffWidth: 1200, layout: 'unified' })).toBe(false);
  });

  it('starts hidden where the diff beside it would be too narrow to read, the markers on lines saying where comments are', () => {
    expect(commentsPanelStartsHidden({ codeThreads: 3, diffWidth: MIN_READABLE_DIFF_WIDTH - 1, layout: 'unified' })).toBe(true);
    expect(commentsPanelStartsHidden({ codeThreads: 3, diffWidth: MIN_READABLE_DIFF_WIDTH, layout: 'unified' })).toBe(false);
  });

  it('side by side, counts the width each side has: two strips of code read no better than one', () => {
    // A 1500 px window leaves the diff about 610 px beside the files and the panel: two sides of about 300.
    expect(commentsPanelStartsHidden({ codeThreads: 3, diffWidth: 610, layout: 'split' })).toBe(true);
    expect(commentsPanelStartsHidden({ codeThreads: 3, diffWidth: 2 * MIN_READABLE_DIFF_WIDTH - 1, layout: 'split' })).toBe(true);
    expect(commentsPanelStartsHidden({ codeThreads: 3, diffWidth: 2 * MIN_READABLE_DIFF_WIDTH, layout: 'split' })).toBe(false);
  });
});

describe('diffWidthBesidePanel', () => {
  it('is what the tab leaves the diff: its width less the files and the panel', () => {
    // A 900 px window leaves the tab about 820: 820 - 340 - 340 = 140, which read as a strip of code.
    expect(diffWidthBesidePanel({ tabWidth: 820, filesWidth: 340, panelWidth: 340 })).toBe(140);
  });
});

describe('New', () => {
  const threads = threadsOf([
    onLine(1, '/a.cs', 1, { appliedInChangeset: 9 }),
    onLine(2, '/a.cs', 2),
    onLine(3, '/b.cs', 1, { kind: 'comment' }),
    comment(4, { kind: 'general' }),
  ]);
  const newIds = new Set([1, 3, 4]);

  it("lists the threads on code new to the user since their last review, and counts them", () => {
    expect(commentsPanelThreads(threads, 'new', NO_COMMENTS_SEARCH, 'code', newIds).map((thread) => thread.root.id)).toEqual([1, 3]);
    expect(commentsPanelCounts(threads, newIds)).toEqual({ open: 1, new: 2, all: 3 });
    expect(threadKindCounts(threads, 'new', newIds)).toEqual({ changeRequest: 1, question: 0, comment: 1 });
  });

  it('is a choice only for a user back after a review of theirs', () => {
    expect(commentsFilterChoices(commentsPanelCounts(threads), undefined).map((choice) => choice.label)).toEqual(['Open 1', 'All 3']);
    expect(commentsFilterChoices(commentsPanelCounts(threads, newIds), newIds).map((choice) => choice.label)).toEqual(['Open 1', 'New 2', 'All 3']);
  });

  it('opens on New for a reviewer back for another round, and as before otherwise', () => {
    expect(initialCommentsFilter(threads, newIds)).toBe('new');
    expect(initialCommentsFilter(threads, new Set())).toBe('open');
    expect(initialCommentsFilter(threads, undefined)).toBe('open');
  });

  it('says when nothing is new', () => {
    expect(emptyCommentsText('new', { open: 0, new: 0, all: 3 }).title).toBe('Nothing new since your last review');
  });
});
