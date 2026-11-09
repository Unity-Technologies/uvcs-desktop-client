import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { comparedFile, hasComments, isCommentable, markerCount, openedOnFocus, outdatedOpensFor } from './fileAnnotation';
import type { LineThread } from './fileThreads';

const ENTRY: DiffEntry = { status: 'changed', path: 'src/Player.cs', itemType: 'file', baseRevisionId: 10, revisionId: 30, repository: 'game@local' };

function thread(id: number): LineThread {
  const root: ReviewComment = { id, guid: `g${id}`, author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor: { kind: 'line', revisionId: 20, itemId: 7, path: '/src/Player.cs', line: 3 } };
  return threadsOf([root])[0] as LineThread;
}

describe('isCommentable', () => {
  it("takes comments on the review's repository's files", () => {
    expect(isCommentable(ENTRY, 'game@local')).toBe(true);
    expect(isCommentable(ENTRY, undefined)).toBe(true);
  });

  it('takes none on a directory, nor on an item under an xlink, which is another repository\'s', () => {
    expect(isCommentable({ ...ENTRY, itemType: 'directory' }, 'game@local')).toBe(false);
    expect(isCommentable({ ...ENTRY, repository: 'engine@local' }, 'game@local')).toBe(false);
  });
});

describe('comparedFile', () => {
  it("is the entry's path and revisions", () => {
    expect(comparedFile(ENTRY)).toEqual({ path: 'src/Player.cs', oldPath: undefined, originalRevision: 10, modifiedRevision: 30 });
  });
});

describe('hasComments', () => {
  it('is any thread at a line or outdated', () => {
    expect(hasComments(null)).toBe(false);
    expect(hasComments({ lines: [], outdated: [] })).toBe(false);
    expect(hasComments({ lines: [], outdated: [{ thread: thread(1), revisionId: 20 }] })).toBe(true);
  });
});

describe('openedOnFocus', () => {
  it('opens the line of a thread gone to while comments are hidden, after the others', () => {
    expect(openedOnFocus(['additions:2'], 'additions:9', false)).toEqual(['additions:2', 'additions:9']);
  });

  it('opens nothing in the code, for a thread at no line, or one already open', () => {
    const opened = ['additions:2'];
    expect(openedOnFocus(opened, 'additions:9', true)).toBe(opened);
    expect(openedOnFocus(opened, undefined, false)).toBe(opened);
    expect(openedOnFocus(opened, 'additions:2', false)).toBe(opened);
  });
});

describe('markerCount', () => {
  it('counts the threads of a line only when there are several', () => {
    expect(markerCount({ threads: [{ thread: thread(1), side: 'additions', line: 1 }] })).toBeNull();
    expect(markerCount({ threads: [1, 2].map((id) => ({ thread: thread(id), side: 'additions' as const, line: 1 })) })).toBe(2);
  });
});

describe('outdatedOpensFor', () => {
  it('opens the outdated threads when one of them is gone to', () => {
    const outdated = [{ thread: thread(1), revisionId: 20 }];
    expect(outdatedOpensFor({ threadId: 1, seq: 2 }, outdated)).toBe(true);
    expect(outdatedOpensFor({ threadId: 5, seq: 2 }, outdated)).toBe(false);
    expect(outdatedOpensFor(null, outdated)).toBe(false);
  });
});
