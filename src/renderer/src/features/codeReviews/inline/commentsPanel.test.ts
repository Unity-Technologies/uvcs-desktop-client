import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { commentPosition, commentsPanelCounts, commentsPanelThreads, emptyCommentsText, initialCommentsFilter, shownCommentsFilter, steppedThread } from './commentsPanel';

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
