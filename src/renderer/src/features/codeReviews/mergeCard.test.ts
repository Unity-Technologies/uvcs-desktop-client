// The menu's words name the moves (`MENU_WORDS`), whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewer, CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { mergeCardOf, mergeReadiness, openItemsIn, openItemsLine, reviewSectionOf, type MergeCardInput, type MergeCardSection } from './mergeCard';

const reviewer = (name: string, status: CodeReviewStatus): CodeReviewer => ({ name, status });

function input(state: MergeRequestState, more: Partial<MergeCardInput> = {}): MergeCardInput {
  return {
    mergeRequest: { state, destination: '/main' },
    status: 'Under review',
    reviewers: [reviewer('ana', 'Under review')],
    source: '/main/task1',
    open: { changeRequests: 0, questions: 0 },
    ...more,
  };
}

const actionLabels = (card: ReturnType<typeof mergeCardOf>) => ({
  footer: card.footer?.label,
  menu: card.menu.map((action) => action.label),
});

describe('reviewSectionOf', () => {
  it('asks for a reviewer when there is none', () => {
    expect(reviewSectionOf([], 'Under review')).toEqual({
      id: 'review',
      tone: 'pending',
      title: 'Review required',
      detail: 'At least 1 approving review is required',
      action: { kind: 'addReviewers', label: 'Add reviewers' },
    });
  });

  it('counts the reviews still pending while under review', () => {
    expect(reviewSectionOf([reviewer('ana', 'Under review')], 'Under review')).toMatchObject({ tone: 'pending', title: 'Changes under review', detail: '1 pending review' });
    expect(reviewSectionOf([reviewer('ana', 'Under review'), reviewer('qa-team', 'Under review'), reviewer('bob', 'Reviewed')], 'Under review')).toMatchObject({
      detail: '2 pending reviews',
    });
  });

  it('counts the reviews asking for changes, failed, while rework is required', () => {
    expect(reviewSectionOf([reviewer('ana', 'Rework required'), reviewer('bob', 'Reviewed')], 'Rework required')).toMatchObject({
      tone: 'failed',
      title: 'Changes required',
      detail: '1 review requesting changes',
    });
    expect(reviewSectionOf([reviewer('ana', 'Rework required'), reviewer('qa-team', 'Rework required')], 'Rework required').detail).toBe('2 reviews requesting changes');
  });

  it('counts the approving reviews, passed, once reviewed; a group counts as one', () => {
    expect(reviewSectionOf([reviewer('qa-team', 'Reviewed')], 'Reviewed')).toMatchObject({ tone: 'passed', title: 'Changes reviewed', detail: '1 approving review' });
    expect(reviewSectionOf([reviewer('ana', 'Reviewed'), reviewer('qa-team', 'Reviewed')], 'Reviewed').detail).toBe('2 approving reviews');
  });

  it('offers to add reviewers only when there is none', () => {
    expect(reviewSectionOf([reviewer('ana', 'Under review')], 'Under review').action).toBeUndefined();
  });
});

describe('openItemsLine', () => {
  it("says what's still open, only when something is", () => {
    expect(openItemsLine({ changeRequests: 3, questions: 1 })).toBe('3 change requests and 1 question open');
    expect(openItemsLine({ changeRequests: 1, questions: 0 })).toBe('1 change request open');
    expect(openItemsLine({ changeRequests: 0, questions: 2 })).toBe('2 questions open');
    expect(openItemsLine({ changeRequests: 0, questions: 0 })).toBeUndefined();
  });
});

describe('openItemsIn', () => {
  const thread = (kind: 'changeRequest' | 'question' | 'comment') => ({ root: { kind } });

  it('counts the change requests and the questions still open among the open threads', () => {
    expect(openItemsIn([thread('changeRequest'), thread('question'), thread('changeRequest')])).toEqual({ changeRequests: 2, questions: 1 });
    expect(openItemsIn([])).toEqual({ changeRequests: 0, questions: 0 });
  });
});

describe('mergeCardOf', () => {
  it('shows a draft as one section, Ready for review its primary action and Close in its menu', () => {
    const card = mergeCardOf(input('Draft'));

    expect(card.sections).toEqual([{ id: 'draft', tone: 'neutral', state: 'Draft', title: 'Draft', detail: 'Not ready to review or merge yet' }]);
    expect(card.footer).toEqual({ kind: 'move', move: { to: 'Open', word: 'readyForReview' }, label: 'Ready for review', primary: true });
    expect(actionLabels(card).menu).toEqual(['Close merge request']);
  });

  it("shows an open one's review, with what's still open under it, and nothing to merge yet", () => {
    const card = mergeCardOf(input('Open', { open: { changeRequests: 2, questions: 1 } }));

    expect(card.sections).toEqual([{ ...reviewSectionOf([reviewer('ana', 'Under review')], 'Under review'), rows: ['2 change requests and 1 question open'] }]);
    expect(actionLabels(card)).toEqual({ footer: undefined, menu: ['Convert to draft', 'Close merge request'] });
  });

  it('shows where a merged one went and the changeset when known, and lets its branch be hidden', () => {
    const card = mergeCardOf(input('Merged', { mergedChangeset: 6, sourceHidden: false }));

    expect(card.sections).toEqual([
      { id: 'merged', tone: 'neutral', state: 'Merged', title: 'Merged into /main', changeset: 6, action: { kind: 'setBranchHidden', branch: '/main/task1', hidden: true, label: 'Hide branch' } },
    ]);
    expect(card.menu).toEqual([]);
  });

  it("lets a merged one's hidden branch show again, and offers neither before knowing which it is", () => {
    expect(mergeCardOf(input('Merged', { sourceHidden: true })).sections[0]!.action).toEqual({ kind: 'setBranchHidden', branch: '/main/task1', hidden: false, label: 'Unhide branch' });
    expect(mergeCardOf(input('Merged')).sections[0]!.action).toBeUndefined();
  });

  it('says merged without a changeset when no note names one', () => {
    expect(mergeCardOf(input('Merged')).sections[0]).not.toHaveProperty('changeset');
  });

  it('offers to switch to the destination when the workspace is still on the merged branch', () => {
    expect(mergeCardOf(input('Merged', { workspaceBranch: '/main/task1' })).footer).toEqual({ kind: 'switchTo', branch: '/main', label: 'Switch to /main' });
    expect(mergeCardOf(input('Merged', { workspaceBranch: '/main' })).footer).toBeUndefined();
    expect(mergeCardOf(input('Merged')).footer).toBeUndefined();
  });

  it('shows a closed one as not merged, and lets it be reopened', () => {
    const card = mergeCardOf(input('Closed'));

    expect(card.sections).toEqual([{ id: 'closed', tone: 'neutral', state: 'Closed', title: 'Closed', detail: 'Not merged' }]);
    expect(card.footer).toEqual({ kind: 'move', move: { to: 'Open', word: 'reopenMergeRequest' }, label: 'Reopen merge request' });
    expect(card.menu).toEqual([]);
  });
});

describe('mergeReadiness', () => {
  const section = (tone: MergeCardSection['tone']): MergeCardSection => ({ id: 'review', tone, title: '' });

  it('is ready once every section passed', () => {
    expect(mergeReadiness([section('passed')])).toBe(true);
    expect(mergeReadiness([section('passed'), section('pending')])).toBe(false);
    expect(mergeReadiness([section('failed')])).toBe(false);
    expect(mergeReadiness([section('neutral')])).toBe(false);
  });

  it('is never ready with nothing to say it is', () => {
    expect(mergeReadiness([])).toBe(false);
  });

  it("is ready for an open request whose review is done, whatever is still open on it (the server's rules decide)", () => {
    expect(mergeReadiness(mergeCardOf(input('Open', { status: 'Reviewed', reviewers: [reviewer('ana', 'Reviewed')] })).sections)).toBe(true);
    expect(mergeReadiness(mergeCardOf(input('Open')).sections)).toBe(false);
  });
});
