// The merge card's words come with the menu's (`MENU_WORDS`), whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { asksForBranchReviews, cardReadsOpenItems, mergeRequestChipOf } from './mergeRequestChipState';
import type { MergeRequestReview } from './mergeRequestState';

function request(id: number, state: MergeRequestState, review: Partial<CodeReviewSummary> = {}): MergeRequestReview {
  const status = review.status ?? 'Under review';
  return { ...codeReviewSummary({ id, title: `Task ${id}`, targetBranchId: 7, reviewers: [{ name: 'ana', status }], ...review }), mergeRequest: { state, destination: '/main' } };
}

describe('asksForBranchReviews', () => {
  const onTask = { kind: 'branch', name: '/main/task' } as const;

  it('asks only for a workspace on a branch', () => {
    expect(asksForBranchReviews(onTask, true)).toBe(true);
    expect(asksForBranchReviews({ kind: 'changeset', name: '12' }, true)).toBe(false);
    expect(asksForBranchReviews({ kind: 'label', name: 'v1.0' }, true)).toBe(false);
    expect(asksForBranchReviews({ kind: 'shelve', name: '3' }, true)).toBe(false);
  });

  it('asks nothing while the workspace is not read yet', () => {
    expect(asksForBranchReviews(undefined, true)).toBe(false);
    expect(asksForBranchReviews(null, true)).toBe(false);
  });

  it('waits for the first screen: nothing until the pending changes are read (or failed)', () => {
    expect(asksForBranchReviews(onTask, false)).toBe(false);
  });
});

describe('mergeRequestChipOf, the chip', () => {
  it('shows the state by its glyph and name, never the number, then the review status while Open', () => {
    const chip = mergeRequestChipOf(request(12, 'Open', { status: 'Reviewed' }));
    expect(chip).toEqual(expect.objectContaining({ reviewId: 12, state: 'Open', stateText: 'Open', verdict: 'ready' }));
    expect(chip).not.toHaveProperty('number');
  });

  it('shows whether it can merge while Open, as a branch chip does', () => {
    expect(mergeRequestChipOf(request(12, 'Open', { status: 'Rework required' })).verdict).toBe('blocked');
    expect(mergeRequestChipOf(request(12, 'Open', { status: 'Under review' })).verdict).toBeUndefined();
  });

  it('shows no review status on a draft: it is not up for review yet', () => {
    const chip = mergeRequestChipOf(request(12, 'Draft', { status: 'Under review' }));
    expect(chip).toMatchObject({ state: 'Draft', stateText: 'Draft' });
    expect(chip.verdict).toBeUndefined();
  });

  it('shows no review status once merged', () => {
    const chip = mergeRequestChipOf(request(12, 'Merged', { status: 'Reviewed' }));
    expect(chip).toMatchObject({ state: 'Merged' });
    expect(chip.verdict).toBeUndefined();
  });

  it('names what it is and where it stands for a screen reader, by its title', () => {
    expect(mergeRequestChipOf(request(12, 'Open', { title: 'Jump higher\nand more', status: 'Reviewed' })).label).toBe('Merge request · Open into /main · Ready to merge: Jump higher');
  });

  it("says no review status where the chip shows none", () => {
    expect(mergeRequestChipOf(request(12, 'Open', { title: 'Jump higher', status: 'Under review' })).label).toBe('Merge request · Open into /main: Jump higher');
    expect(mergeRequestChipOf(request(12, 'Draft', { title: 'Jump higher' })).label).toBe('Merge request · Draft into /main: Jump higher');
    expect(mergeRequestChipOf(request(12, 'Merged', { title: 'Jump higher' })).label).toBe('Merge request · Merged into /main: Jump higher');
  });
});

describe('mergeRequestChipOf, the hover card', () => {
  it('counts the change requests and questions open, only when any', () => {
    expect(mergeRequestChipOf(request(12, 'Open'), { changeRequests: 3, questions: 1 }).card.openItems).toBe('3 change requests and 1 question open');
    expect(mergeRequestChipOf(request(12, 'Open'), { changeRequests: 0, questions: 0 }).card.openItems).toBeUndefined();
    expect(mergeRequestChipOf(request(12, 'Open')).card.openItems).toBeUndefined();
  });

  it.each(['Draft', 'Merged'] as const)('counts nothing open on a %s one', (state) => {
    expect(mergeRequestChipOf(request(12, state), { changeRequests: 2, questions: 0 }).card.openItems).toBeUndefined();
  });

  it.each(['Draft', 'Open', 'Merged'] as const)('offers no button on a %s one not reviewed: its title opens it', (state) => {
    expect(mergeRequestChipOf(request(12, state), undefined, '/main/task').card.actions).toEqual([]);
  });

  it('offers Merge into its destination once an Open one is reviewed', () => {
    const { card } = mergeRequestChipOf(request(12, 'Open', { status: 'Reviewed' }), undefined, '/main/task');
    expect(card.actions.map(({ kind, label, primary }) => ({ kind, label, primary }))).toEqual([{ kind: 'merge', label: 'Merge into main…', primary: true }]);
    expect(card.actions[0]).toMatchObject({ merge: { source: '/main/task', request: { id: 12 } } });
  });

  it("offers no Merge on a reviewed request that isn't Open", () => {
    expect(mergeRequestChipOf(request(12, 'Merged', { status: 'Reviewed' }), undefined, '/main/task').card.actions).toEqual([]);
  });
});

describe('cardReadsOpenItems', () => {
  it('reads the conversation once the card of an Open request with something open shows', () => {
    expect(cardReadsOpenItems(request(12, 'Open', { openIssueCount: 2 }), true)).toBe(true);
  });

  it('reads nothing while the card is closed', () => {
    expect(cardReadsOpenItems(request(12, 'Open', { openIssueCount: 2 }), false)).toBe(false);
  });

  it('reads nothing when nothing is open, nor for a draft or a merged one', () => {
    expect(cardReadsOpenItems(request(12, 'Open', { openIssueCount: 0 }), true)).toBe(false);
    expect(cardReadsOpenItems(request(12, 'Draft', { openIssueCount: 2 }), true)).toBe(false);
    expect(cardReadsOpenItems(request(12, 'Merged', { openIssueCount: 2 }), true)).toBe(false);
  });
});
