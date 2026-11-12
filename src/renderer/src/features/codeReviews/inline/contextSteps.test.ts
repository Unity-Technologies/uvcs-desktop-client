import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { contextFooterAction, contextStepsOf, showInChangesPage } from './contextSteps';
import type { LineThread } from './fileThreads';

const BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/waves' };

function lineThread(fields: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = {
    id: 52,
    guid: 'g52',
    author: 'vio',
    date: '2026-11-09T15:00:00+01:00',
    text: 'Cap a single tick too',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Waves/WaveSpawner.cs', line: 5 },
    ...fields,
  };
  return threadsOf([root])[0] as LineThread;
}

describe('contextStepsOf', () => {
  const groups = [
    { threadIds: [2, 4], scope: 'Round 1' },
    { threadIds: [5, 1, 3], scope: 'New since last review' },
  ];

  it('says where the thread is among those settled in its part of the conversation, and which come before and after', () => {
    expect(contextStepsOf(groups, 1)).toEqual({ position: 'New since last review · 2 of 3', previous: 5, next: 3 });
    expect(contextStepsOf(groups, 2)).toEqual({ position: 'Round 1 · 1 of 2', previous: undefined, next: 4 });
  });

  it('says only where it is when the conversation has no rounds', () => {
    expect(contextStepsOf([{ threadIds: [5, 6], scope: '' }], 6)).toEqual({ position: '2 of 2', previous: 5, next: undefined });
  });

  it('steps nowhere for a thread that settled nothing, or a lone one', () => {
    expect(contextStepsOf(groups, 9)).toBeUndefined();
    expect(contextStepsOf([{ threadIds: [5], scope: 'Round 1' }], 5)).toBeUndefined();
    expect(contextStepsOf(undefined, 5)).toBeUndefined();
  });
});

describe('showInChangesPage', () => {
  it('opens a request applied on a branch in the changeset that applied it, at the thread', () => {
    expect(showInChangesPage(39, BRANCH, lineThread({ appliedInChangeset: 5 }))).toEqual({
      kind: 'codeReview',
      reviewId: 39,
      tab: 'changes',
      focusPath: 'Assets/Waves/WaveSpawner.cs',
      focusThread: 52,
      focusChangeset: 5,
    });
  });

  it('opens any other thread where it was written', () => {
    expect(showInChangesPage(39, BRANCH, lineThread({ changesetId: 3 }))).toEqual(expect.objectContaining({ focusChangeset: 3, focusThread: 52 }));
    expect(showInChangesPage(39, BRANCH, lineThread())).not.toHaveProperty('focusChangeset');
  });

  it('opens a review of a changeset at the thread, as it has one diff', () => {
    expect(showInChangesPage(39, { kind: 'changeset', changesetId: 8 }, lineThread({ appliedInChangeset: 9 }))).not.toHaveProperty('focusChangeset');
  });
});

describe('contextFooterAction', () => {
  it("opens a request applied on a branch in the review's Changes, named by its changeset", () => {
    expect(contextFooterAction(BRANCH, lineThread({ appliedInChangeset: 5 }))).toEqual({ kind: 'changes', label: 'Open changeset 5' });
  });

  it("shows anything else where it was written, in the review's Changes", () => {
    expect(contextFooterAction(BRANCH, lineThread())).toEqual({ kind: 'changes', label: 'Show in Changes' });
  });

  it('opens a changeset of a review of no branch on its own page, where it is', () => {
    expect(contextFooterAction({ kind: 'changeset', changesetId: 8 }, lineThread({ appliedInChangeset: 9 }))).toEqual({ kind: 'changesetPage', label: 'Open changeset 9', changesetId: 9 });
  });
});
