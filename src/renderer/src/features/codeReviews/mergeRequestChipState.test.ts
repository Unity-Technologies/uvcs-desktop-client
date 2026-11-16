// The merge card's words come with the menu's (`MENU_WORDS`), whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { asksForBranchReviews, cardReadsOpenItems, mergeRequestChipOf } from './mergeRequestChipState';
import type { MergeRequestReview } from './mergeRequestState';

function request(id: number, state: MergeRequestState, review: Partial<CodeReviewSummary> = {}): MergeRequestReview {
  return { ...codeReviewSummary({ id, title: `Task ${id}`, targetBranchId: 7, ...review }), mergeRequest: { state, destination: '/main' } };
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
  it('shows the state and the number, then the review status while Open', () => {
    const chip = mergeRequestChipOf(request(12, 'Open', { status: 'Reviewed' }));
    expect(chip).toMatchObject({ reviewId: 12, state: 'Open', number: '#12', status: 'Reviewed', muted: false });
  });

  it.each(['Under review', 'Rework required'] as const)('shows the status %s while Open', (status) => {
    expect(mergeRequestChipOf(request(12, 'Open', { status })).status).toBe(status);
  });

  it('shows no review status on a draft: it is not up for review yet', () => {
    const chip = mergeRequestChipOf(request(12, 'Draft', { status: 'Under review' }));
    expect(chip).toMatchObject({ state: 'Draft', number: '#12', muted: false });
    expect(chip.status).toBeUndefined();
  });

  it('is muted, with no review status, once merged', () => {
    const chip = mergeRequestChipOf(request(12, 'Merged', { status: 'Reviewed' }));
    expect(chip).toMatchObject({ state: 'Merged', muted: true });
    expect(chip.status).toBeUndefined();
  });

  it('names what it is and where it stands for a screen reader', () => {
    expect(mergeRequestChipOf(request(12, 'Open', { title: 'Jump higher\nand more' })).label).toBe('Merge request 12 · Open into /main · Under review: Jump higher');
  });

  it("says no review status where the chip shows none", () => {
    expect(mergeRequestChipOf(request(12, 'Draft', { title: 'Jump higher' })).label).toBe('Merge request 12 · Draft into /main: Jump higher');
    expect(mergeRequestChipOf(request(12, 'Merged', { title: 'Jump higher' })).label).toBe('Merge request 12 · Merged into /main: Jump higher');
  });
});

describe('mergeRequestChipOf, the hover card', () => {
  const ana = { name: 'ana', status: 'Reviewed' as const };
  const bob = { name: 'bob', status: 'Under review' as const };

  it('has the title on one line and where it merges', () => {
    const { card } = mergeRequestChipOf(request(12, 'Open', { title: 'Jump higher\nand more' }));
    expect(card.title).toBe('Jump higher');
    expect(card.where).toBe('Open · into /main');
  });

  it('says where the review stands while Open, from its reviewers, with them', () => {
    const { card } = mergeRequestChipOf(request(12, 'Open', { status: 'Under review', reviewers: [ana, bob] }));
    expect(card.review).toEqual({ status: 'Under review', title: 'Changes under review', detail: '1 pending review' });
    expect(card.showsReviewers).toBe(true);
  });

  it('says a review is required when nobody reviews it, with no empty stack under it', () => {
    const { card } = mergeRequestChipOf(request(12, 'Open', { reviewers: [] }));
    expect(card.review).toEqual({ status: 'Under review', title: 'Review required', detail: 'At least 1 approving review is required' });
    expect(card.showsReviewers).toBe(false);
  });

  it('says it is reviewed once everyone approved', () => {
    expect(mergeRequestChipOf(request(12, 'Open', { status: 'Reviewed', reviewers: [ana] })).card.review).toEqual({ status: 'Reviewed', title: 'Changes reviewed', detail: '1 approving review' });
  });

  it('counts the change requests and questions open, only when any', () => {
    expect(mergeRequestChipOf(request(12, 'Open'), { changeRequests: 3, questions: 1 }).card.openItems).toBe('3 change requests and 1 question open');
    expect(mergeRequestChipOf(request(12, 'Open'), { changeRequests: 0, questions: 0 }).card.openItems).toBeUndefined();
    expect(mergeRequestChipOf(request(12, 'Open')).card.openItems).toBeUndefined();
  });

  it('shows a draft as not ready, with its reviewers and no review status', () => {
    const { card } = mergeRequestChipOf(request(12, 'Draft', { reviewers: [bob] }), { changeRequests: 2, questions: 0 });
    expect(card.where).toBe('Draft · into /main');
    expect(card.review).toBeUndefined();
    expect(card.showsReviewers).toBe(true);
    expect(card.openItems).toBeUndefined();
  });

  it('shows nothing of the reviewers of a draft nobody reviews yet', () => {
    expect(mergeRequestChipOf(request(12, 'Draft', { reviewers: [] })).card.showsReviewers).toBe(false);
  });

  it('shows a merged one as merged into its destination, nothing more', () => {
    const { card } = mergeRequestChipOf(request(12, 'Merged', { reviewers: [ana] }), { changeRequests: 1, questions: 0 });
    expect(card.where).toBe('Merged into /main');
    expect(card.review).toBeUndefined();
    expect(card.showsReviewers).toBe(false);
    expect(card.openItems).toBeUndefined();
  });

  it.each(['Draft', 'Open', 'Merged'] as const)('offers Open on a %s one not reviewed', (state) => {
    expect(mergeRequestChipOf(request(12, state), undefined, '/main/task').card.actions).toEqual([{ kind: 'open', label: 'Open', primary: true }]);
  });

  it('offers Merge into its destination first once an Open one is reviewed, Open beside it', () => {
    const { card } = mergeRequestChipOf(request(12, 'Open', { status: 'Reviewed' }), undefined, '/main/task');
    expect(card.actions.map(({ kind, label, primary }) => ({ kind, label, primary }))).toEqual([
      { kind: 'merge', label: 'Merge into main…', primary: true },
      { kind: 'open', label: 'Open', primary: false },
    ]);
    expect(card.actions[0]).toMatchObject({ merge: { source: '/main/task', request: { id: 12 } } });
  });

  it("offers no Merge on a reviewed request that isn't Open", () => {
    expect(mergeRequestChipOf(request(12, 'Merged', { status: 'Reviewed' }), undefined, '/main/task').card.actions.map((action) => action.kind)).toEqual(['open']);
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
