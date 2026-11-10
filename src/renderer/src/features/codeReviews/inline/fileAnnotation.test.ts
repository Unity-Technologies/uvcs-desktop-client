import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { comparedFile, fileThreadCount, hasComments, isCommentable, openedOnFocus, outdatedOpensFor } from './fileAnnotation';
import type { LineThread } from './fileThreads';

const ENTRY: DiffEntry = { status: 'changed', path: 'src/Player.cs', itemType: 'file', baseRevisionId: 10, revisionId: 30, repository: 'game@local' };

function thread(id: number, extra: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = { id, guid: `g${id}`, author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor: { kind: 'line', revisionId: 20, itemId: 7, path: '/src/Player.cs', line: 3 }, ...extra };
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
  const goneTo = { threadId: 1, seq: 2 };

  it('opens the line of a thread gone to while comments are hidden, after the others', () => {
    expect(openedOnFocus(['additions:2'], goneTo, 'additions:9', false)).toEqual(['additions:2', 'additions:9']);
  });

  it('opens nothing in the code, for a thread at no line, or one already open', () => {
    const opened = ['additions:2'];
    expect(openedOnFocus(opened, goneTo, 'additions:9', true)).toBe(opened);
    expect(openedOnFocus(opened, goneTo, undefined, false)).toBe(opened);
    expect(openedOnFocus(opened, goneTo, 'additions:2', false)).toBe(opened);
  });

  it("doesn't open again a line whose card was picked in place: its Hide, which picks it too, folded it", () => {
    const opened = ['additions:2'];
    expect(openedOnFocus(opened, { threadId: 1, seq: 3, inPlace: true }, 'additions:9', false)).toBe(opened);
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

describe('fileThreadCount', () => {
  const BRANCH = { kind: 'branch', branch: '/main/task' } as const;
  const onPlayer = (id: number, revisionId: number, extra: Partial<ReviewComment> = {}): ReviewComment => ({
    id,
    guid: `g${id}`,
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: '',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId, itemId: 7, path: '/src/Player.cs', line: 3 },
    ...extra,
  });
  const threads = threadsOf([
    onPlayer(1, 30),
    onPlayer(2, 20),
    onPlayer(3, 10, { changesetId: 8 }),
    { ...onPlayer(4, 30), anchor: { kind: 'line', revisionId: 30, itemId: 9, path: '/src/Enemy.cs', line: 1 } },
    { ...onPlayer(5, 30), anchor: { kind: 'review' } },
  ]);

  it("counts the file's threads the whole branch shows: on its versions, on earlier ones, and those written changeset by changeset", () => {
    expect(fileThreadCount(threads, BRANCH, { kind: 'whole' }, ENTRY)).toBe(3);
  });

  it("counts only those written in a changeset in that changeset's diff", () => {
    expect(fileThreadCount(threads, BRANCH, { kind: 'changeset', changesetId: 8 }, ENTRY)).toBe(1);
  });

  it('counts none on a file without threads, by its path or the one it moved from', () => {
    expect(fileThreadCount(threads, BRANCH, { kind: 'whole' }, { ...ENTRY, path: 'src/Other.cs' })).toBe(0);
    expect(fileThreadCount(threads, BRANCH, { kind: 'whole' }, { ...ENTRY, path: 'src/game/Player.cs', oldPath: 'src/Player.cs' })).toBe(3);
  });
});
