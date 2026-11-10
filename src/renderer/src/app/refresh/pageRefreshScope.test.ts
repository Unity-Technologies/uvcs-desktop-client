import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import { pageRefreshScope } from './pageRefreshScope';

const key = (...parts: unknown[]) => ['workspace', '/ws', ...parts];
const ofBranch = (): CodeReviewTarget => ({ kind: 'branch', branch: '/main/task-12' });

describe('pageRefreshScope', () => {
  it("refreshes only what a code review's page shows, its branch's changes by the review already read", () => {
    const scope = pageRefreshScope({ kind: 'codeReview', reviewId: 7, tab: 'changes' }, ofBranch);

    expect(scope?.(key('codeReviews', 'conversation', 7))).toBe(true);
    expect(scope?.(key('diff', { kind: 'branch', branch: '/main/task-12' }))).toBe(true);
    expect(scope?.(key('codeReviews', {}))).toBe(false);
    expect(scope?.(key('pendingChanges', 'all'))).toBe(false);
  });

  it('asks what the review in front is of, by its number', () => {
    const asked: number[] = [];
    pageRefreshScope({ kind: 'codeReview', reviewId: 7 }, (reviewId) => {
      asked.push(reviewId);
      return undefined;
    });

    expect(asked).toEqual([7]);
  });

  it('refreshes everything the window shows with any other page in front, or none', () => {
    expect(pageRefreshScope(undefined, ofBranch)).toBeUndefined();
    expect(pageRefreshScope({ kind: 'history', path: 'src/a.ts' }, ofBranch)).toBeUndefined();
    expect(pageRefreshScope({ kind: 'diff', title: '/main', target: { kind: 'branch', branch: '/main' } }, ofBranch)).toBeUndefined();
  });
});
