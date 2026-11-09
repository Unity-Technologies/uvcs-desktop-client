import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { annotationRowsOf, fileCommentsOf, OUTDATED_ROW, showsCommentControls, threadPlace, topSideOf, versionsToRead } from './fileComments';
import type { ShownFile } from './fileThreads';
import { lineThreadsOf } from './threadRows';

const BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };
const WHOLE = { kind: 'whole' } as const;
const PLAYER: ShownFile = { path: 'src/Player.cs', originalRevision: 10, modifiedRevision: 30 };

const onLine = (id: number, revisionId: number, line: number, fields: Partial<ReviewComment> = {}): ReviewComment => ({
  id,
  guid: `g${id}`,
  author: 'ana',
  date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`,
  text: `Comment ${id}`,
  kind: 'changeRequest',
  anchor: { kind: 'line', revisionId, itemId: 7, path: '/src/Player.cs', line },
  ...fields,
});

const text = (...lines: string[]): string => lines.map((line) => `${line}\n`).join('');
// Revision 20, commented on at cs:8; revision 30, the newest: a line added on top, line 3 edited.
const TEXTS = new Map([
  [20, text('a', 'b', 'c', 'd')],
  [30, text('new', 'a', 'b', 'c edited', 'd')],
]);

describe('fileCommentsOf', () => {
  const threads = threadsOf([onLine(1, 30, 2), onLine(2, 20, 2), onLine(3, 20, 3), onLine(4, 20, 3, { changesetId: 8 })]);

  it('places the threads on the newest version, those on an earlier one whose line is unchanged, and keeps apart those outdated', () => {
    const comments = fileCommentsOf({ threads, review: BRANCH, view: WHOLE, file: PLAYER, textOf: (revision) => TEXTS.get(revision) });
    expect(comments.lines.map((line) => [line.key, line.threads.map((entry) => entry.thread.root.id)])).toEqual([
      ['additions:2', [1]],
      ['additions:3', [2]],
    ]);
    expect(comments.outdated.map((entry) => entry.thread.root.id)).toEqual([3]);
  });

  it('shows an outdated thread in the view it was written in only', () => {
    const inChangeset = fileCommentsOf({ threads, review: BRANCH, view: { kind: 'changeset', changesetId: 8 }, file: PLAYER, textOf: (revision) => TEXTS.get(revision) });
    expect(inChangeset.outdated.map((entry) => entry.thread.root.id)).toEqual([4]);
  });

  it('places none of the earlier threads until the newer version is read', () => {
    const comments = fileCommentsOf({ threads, review: BRANCH, view: WHOLE, file: PLAYER, textOf: (revision) => (revision === 20 ? TEXTS.get(20) : undefined) });
    expect(comments.lines.map((line) => line.key)).toEqual(['additions:2']);
    expect(comments.outdated).toEqual([]);
  });

  it("tells every earlier thread outdated on a deleted file, which has no newer version", () => {
    const deleted: ShownFile = { path: 'src/Player.cs', originalRevision: 25, modifiedRevision: -1 };
    const comments = fileCommentsOf({ threads: threadsOf([onLine(1, 20, 1)]), review: BRANCH, view: WHOLE, file: deleted, textOf: (revision) => TEXTS.get(revision) });
    expect(comments.outdated.map((entry) => entry.thread.root.id)).toEqual([1]);
  });

  it('shows the threads on the revision compared with on its side, since a comment', () => {
    const since: ShownFile = { ...PLAYER, originalRevision: 20 };
    const comments = fileCommentsOf({ threads, review: BRANCH, view: WHOLE, file: since, textOf: (revision) => TEXTS.get(revision) });
    expect(comments.lines.map((line) => line.key)).toEqual(['deletions:2', 'deletions:3', 'additions:2']);
    expect(comments.outdated).toEqual([]);
  });
});

describe('annotationRowsOf', () => {
  const [thread] = threadsOf([onLine(1, 30, 2)]);
  const rows = lineThreadsOf([{ thread: thread as never, side: 'additions', line: 2 }]);

  it('names each line by its key', () => {
    expect(annotationRowsOf({ rows }, [], 'additions')).toEqual([{ side: 'additions', lineNumber: 2, metadata: 'additions:2' }]);
  });

  it("lists the lines placed once an earlier version is read after the others, and the outdated ones last: Pierre keys rows by their place", () => {
    const [onShown, onEarlier] = threadsOf([onLine(1, 30, 9), onLine(2, 20, 3)]);
    const lines = lineThreadsOf([
      { thread: onEarlier as never, side: 'additions', line: 4, earlier: { thread: onEarlier as never, revisionId: 20 } },
      { thread: onShown as never, side: 'additions', line: 9 },
    ]);
    const outdated = [{ thread: onEarlier as never, revisionId: 20 }];
    expect(annotationRowsOf({ rows: lines }, outdated, 'additions').map((row) => row.metadata)).toEqual(['additions:9', 'additions:4', OUTDATED_ROW]);
  });

  it('puts the outdated threads above the code, on the side the file has', () => {
    const outdated = [{ thread: thread as never, revisionId: 20 }];
    expect(annotationRowsOf({ rows: [] }, outdated, 'deletions')).toEqual([{ side: 'deletions', lineNumber: 0, metadata: OUTDATED_ROW }]);
  });
});

describe('threadPlace', () => {
  const comments = fileCommentsOf({ threads: threadsOf([onLine(1, 30, 2), onLine(3, 20, 3)]), review: BRANCH, view: WHOLE, file: PLAYER, textOf: (revision) => TEXTS.get(revision) });

  it("is a thread's line, or the top of the code for an outdated one, or nothing for another file's", () => {
    expect(threadPlace(comments, 1, 'additions')).toEqual({ side: 'additions', lineNumber: 2, lineKey: 'additions:2' });
    expect(threadPlace(comments, 3, 'additions')).toEqual({ side: 'additions', lineNumber: 0 });
    expect(threadPlace(comments, 99, 'additions')).toBeNull();
  });
});

describe('versionsToRead', () => {
  it('reads the earlier versions threads were written on, and the newer side to place them', () => {
    const threads = threadsOf([onLine(1, 30, 2), onLine(2, 20, 2), onLine(3, 25, 1), onLine(4, 20, 9)]);
    expect(versionsToRead({ threads, review: BRANCH, view: WHOLE, file: PLAYER })).toEqual([20, 25, 30]);
  });

  it('reads nothing when every thread is on a version shown, nor a newer side a deleted file lacks', () => {
    expect(versionsToRead({ threads: threadsOf([onLine(1, 30, 2)]), review: BRANCH, view: WHOLE, file: PLAYER })).toEqual([]);
    const deleted: ShownFile = { path: 'src/Player.cs', originalRevision: 25, modifiedRevision: -1 };
    expect(versionsToRead({ threads: threadsOf([onLine(1, 20, 2)]), review: BRANCH, view: WHOLE, file: deleted })).toEqual([20]);
  });
});

describe('topSideOf', () => {
  it('is the newer side, or the older one of a deleted file', () => {
    expect(topSideOf(PLAYER)).toBe('additions');
    expect(topSideOf({ modifiedRevision: -1 })).toBe('deletions');
  });
});

describe('showsCommentControls', () => {
  it('shows them on a file with threads, or compared since one', () => {
    expect(showsCommentControls(null, false)).toBe(false);
    expect(showsCommentControls({ lines: [], outdated: [] }, false)).toBe(false);
    expect(showsCommentControls({ lines: [], outdated: [] }, true)).toBe(true);
    expect(showsCommentControls({ lines: [], outdated: [{ thread: threadsOf([onLine(1, 20, 1)])[0] as never, revisionId: 20 }] }, false)).toBe(true);
  });
});
