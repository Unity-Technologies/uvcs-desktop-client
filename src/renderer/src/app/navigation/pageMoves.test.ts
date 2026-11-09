import { describe, expect, it } from 'vitest';
import { movesWithinTop } from './pageMoves';
import type { Page } from './pages';

const review = (reviewId: number, fields: Partial<Extract<Page, { kind: 'codeReview' }>> = {}): Page => ({ kind: 'codeReview', reviewId, ...fields });

describe('movesWithinTop', () => {
  it("moves a review's page within itself to another place in the same review: a comment's file from its conversation", () => {
    expect(movesWithinTop(review(41, { tab: 'conversation' }), review(41, { tab: 'changes', focusPath: 'src/Player.cs', focusThread: 7 }))).toBe(true);
  });

  it('stacks another review, and any page over a review or under nothing', () => {
    expect(movesWithinTop(review(41), review(42))).toBe(false);
    expect(movesWithinTop(review(41), { kind: 'diff', title: 'Changeset 8', target: { kind: 'changeset', changesetId: 8 } })).toBe(false);
    expect(movesWithinTop(undefined, review(41))).toBe(false);
  });
});
