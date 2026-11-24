import { describe, expect, it } from 'vitest';
import { reviewChipPage } from './reviewChipPage';

const BRANCH_CHANGESETS = new Set([5, 7, 8]);

describe('reviewChipPage', () => {
  it("opens a changeset of the review's branch in the review's Changes, selected", () => {
    expect(reviewChipPage(39, { kind: 'changeset', id: 7 }, BRANCH_CHANGESETS)).toEqual({ kind: 'codeReview', reviewId: 39, tab: 'changes', focusChangeset: 7 });
  });

  it('leaves anything else to the chip: another changeset, another repository, another kind, a review of no branch', () => {
    expect(reviewChipPage(39, { kind: 'changeset', id: 3 }, BRANCH_CHANGESETS)).toBeUndefined();
    expect(reviewChipPage(39, { kind: 'changeset', id: 7, repository: 'other@cloud' }, BRANCH_CHANGESETS)).toBeUndefined();
    expect(reviewChipPage(39, { kind: 'branch', name: '/main/waves' }, BRANCH_CHANGESETS)).toBeUndefined();
    expect(reviewChipPage(39, { kind: 'changeset', id: 7 }, undefined)).toBeUndefined();
  });
});
