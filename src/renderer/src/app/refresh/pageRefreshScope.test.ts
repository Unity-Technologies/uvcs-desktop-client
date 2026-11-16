import { describe, expect, it } from 'vitest';
import type { CodeReview, MergeRequestState } from '@shared/domain/codeReview';
import { pageRefreshScope } from './pageRefreshScope';

const key = (...parts: unknown[]) => ['workspace', '/ws', ...parts];
const ofBranch = (): Pick<CodeReview, 'target' | 'mergeRequest'> => ({ target: { kind: 'branch', branch: '/main/task-12' } });
const ofRequest = (state: MergeRequestState = 'Open') => (): Pick<CodeReview, 'target' | 'mergeRequest'> => ({ ...ofBranch(), mergeRequest: { state, destination: '/main' } });
const never = () => false;
const checkedTask12 = (source: string) => source === '/main/task-12';

describe('pageRefreshScope', () => {
  it("refreshes only what a code review's page shows, its branch's changes by the review already read", () => {
    const scope = pageRefreshScope({ kind: 'codeReview', reviewId: 7, tab: 'changes' }, ofBranch, never);

    expect(scope?.(key('codeReviews', 'conversation', 7))).toBe(true);
    expect(scope?.(key('diff', { kind: 'branch', branch: '/main/task-12' }))).toBe(true);
    expect(scope?.(key('codeReviews', {}))).toBe(false);
    expect(scope?.(key('pendingChanges', 'all'))).toBe(false);
  });

  const page = { kind: 'codeReview', reviewId: 7, tab: 'conversation' } as const;
  const readsDestination = (scope: ReturnType<typeof pageRefreshScope>) => scope?.(key('branches', 'byName', '/main'));

  it("refreshes an open merge request's destination branch too once its conflicts were checked, whose head keys the check", () => {
    expect(readsDestination(pageRefreshScope(page, ofRequest(), checkedTask12))).toBe(true);
  });

  it("leaves the destination alone when the conflicts were never checked: a Refresh costs no branch read for a check nobody asked", () => {
    expect(readsDestination(pageRefreshScope(page, ofRequest(), never))).toBe(false);
  });

  it('leaves the destination alone for a request that is not open, and for a plain review', () => {
    expect(readsDestination(pageRefreshScope(page, ofRequest('Merged'), checkedTask12))).toBe(false);
    expect(readsDestination(pageRefreshScope(page, ofRequest('Draft'), checkedTask12))).toBe(false);
    expect(readsDestination(pageRefreshScope(page, ofBranch, checkedTask12))).toBe(false);
  });

  it('refreshes everything the window shows with any other page in front, or none', () => {
    expect(pageRefreshScope(undefined, ofBranch, never)).toBeUndefined();
    expect(pageRefreshScope({ kind: 'history', path: 'src/a.ts' }, ofBranch, never)).toBeUndefined();
    expect(pageRefreshScope({ kind: 'diff', title: '/main', target: { kind: 'branch', branch: '/main' } }, ofBranch, never)).toBeUndefined();
  });
});
