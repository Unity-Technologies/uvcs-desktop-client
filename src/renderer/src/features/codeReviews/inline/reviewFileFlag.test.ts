import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { reviewFileFlag } from './reviewFileFlag';

const BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };

function onLine(id: number, path: string, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor: { kind: 'line', revisionId: 30, itemId: 7, path: `/${path}`, line: 3 }, ...fields };
}

function entry(path: string): DiffEntry {
  return { status: 'changed', path, itemType: 'file', baseRevisionId: 10, revisionId: 30, repository: 'game@local' };
}

const threads = threadsOf([onLine(1, 'src/Player.cs'), onLine(2, 'src/Player.cs'), onLine(3, 'src/Enemy.cs', { changesetId: 8 })]);

describe('reviewFileFlag', () => {
  it('marks a file with how many comments it holds in the whole branch, and none without', () => {
    const markOf = reviewFileFlag(threads, BRANCH).markOf({ kind: 'branch', branch: '/main/task' });
    expect(markOf(entry('src/Player.cs'))).toBe('2 comments');
    expect(markOf(entry('src/Enemy.cs'))).toBe('1 comment');
    expect(markOf(entry('src/Other.cs'))).toBeNull();
  });

  it("counts in a changeset's diff only the comments written in it", () => {
    const markOf = reviewFileFlag(threads, BRANCH).markOf({ kind: 'changeset', changesetId: 8 });
    expect(markOf(entry('src/Player.cs'))).toBeNull();
    expect(markOf(entry('src/Enemy.cs'))).toBe('1 comment');
  });

  it('offers a "Commented" chip', () => {
    expect(reviewFileFlag(threads, BRANCH).filterLabel).toBe('Commented');
  });
});
