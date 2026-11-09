import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread } from './fileThreads';
import {
  commentPosition,
  commentsPanelCounts,
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
    expect(commentsPanelCounts(THREADS)).toEqual({ open: 1, all: 4 });
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
    expect(emptyCommentsText('all', { open: 0, all: 0 }).title).toBe('No comments on the code yet');
    expect(emptyCommentsText('open', { open: 0, all: 3 }).title).toBe('Nothing left to answer');
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
});

describe('shownCommentsFilter', () => {
  it('keeps the filter the panel opened on as threads settle, until one is picked', () => {
    expect(shownCommentsFilter(null, 'open')).toBe('open');
    expect(shownCommentsFilter('all', 'open')).toBe('all');
    expect(shownCommentsFilter(null, null)).toBe('all');
  });
});
