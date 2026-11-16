import { describe, expect, it } from 'vitest';
import type { MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { mergeRequestInto, mergeRuleNotice, mergeRuleRefusal, needsBranchReviews } from './mergeRuleRefusal';

describe('mergeRuleRefusal', () => {
  it('recognizes a branch that needs an open merge request to its destination', () => {
    expect(mergeRuleRefusal("Cannot perform the merge because of the Merge Rules. Branch '/main/task1' needs an open merge request to '/main'.")).toEqual({
      rule: 'needsMergeRequest',
      source: '/main/task1',
      destination: '/main',
    });
  });

  it('recognizes a branch that must be reviewed before it merges', () => {
    expect(mergeRuleRefusal("Cannot perform the merge because of the Merge Rules. Review the branch '/main/task1' to merge it to '/main'.")).toEqual({
      rule: 'needsReview',
      source: '/main/task1',
      destination: '/main',
    });
  });

  it('keeps branch names with spaces and accents whole', () => {
    expect(mergeRuleRefusal("Cannot perform the merge because of the Merge Rules. Branch '/main/versión 2/add login' needs an open merge request to '/main/versión 2'.")).toEqual({
      rule: 'needsMergeRequest',
      source: '/main/versión 2/add login',
      destination: '/main/versión 2',
    });
  });

  it('finds the rule inside a longer message, as an error prints it', () => {
    expect(mergeRuleRefusal("Error: Cannot perform the merge because of the Merge Rules. Review the branch '/main/task1' to merge it to '/main'.\r\n")?.rule).toBe('needsReview');
  });

  it("leaves every other failure to cm's own message", () => {
    expect(mergeRuleRefusal("The current Merge Rules configuration doesn't allow branch '/main/task1' to be merged into '/main'.")).toBeUndefined();
    expect(mergeRuleRefusal('The specified branch /main/nope can\'t be found.')).toBeUndefined();
    expect(mergeRuleRefusal('')).toBeUndefined();
  });

  it("leaves a translated message to cm's own words", () => {
    expect(mergeRuleRefusal("No se puede realizar el merge debido al sistema de reglas de merge. La rama origen '/main/task1' tiene que estar revisada con éxito antes de que se pueda hacer merge a '/main'.")).toBeUndefined();
  });
});

describe('mergeRequestInto', () => {
  const request = (id: number, state: MergeRequestState, destination = '/main') => codeReviewSummary({ id, mergeRequest: { state, destination } });

  it("finds the branch's merge request still to merge into that destination", () => {
    expect(mergeRequestInto([request(3, 'Merged'), request(12, 'Open')], '/main')).toBe(12);
    expect(mergeRequestInto([request(8, 'Draft')], '/main')).toBe(8);
  });

  it('finds none into another destination, closed or merged, or among plain code reviews', () => {
    expect(mergeRequestInto([request(4, 'Open', '/main/release'), request(2, 'Closed'), request(3, 'Merged'), codeReviewSummary({ id: 5 })], '/main')).toBeUndefined();
    expect(mergeRequestInto(undefined, '/main')).toBeUndefined();
  });
});

const refusal = (rule: 'needsMergeRequest' | 'needsReview') => ({ rule, source: '/main/task1', destination: '/main' }) as const;
const openedFrom = { id: 12, title: 'Add login' };

describe('needsBranchReviews', () => {
  it("reads the branch's reviews only to find the request a review rule asks to open, when the merge wasn't opened from it", () => {
    expect(needsBranchReviews(refusal('needsReview'), undefined)).toBe(true);
    expect(needsBranchReviews(refusal('needsReview'), openedFrom)).toBe(false);
    expect(needsBranchReviews(refusal('needsMergeRequest'), undefined)).toBe(false);
  });
});

describe('mergeRuleNotice', () => {
  it('says a branch needs an open merge request, plainly, and offers to create it', () => {
    expect(mergeRuleNotice(refusal('needsMergeRequest'), undefined, undefined)).toEqual({
      title: 'This server merges into main only branches with an open merge request',
      action: { kind: 'createMergeRequest', branch: '/main/task1', label: 'Create merge request' },
    });
  });

  it('opens the merge request the merge was opened from when it must be reviewed first', () => {
    expect(mergeRuleNotice(refusal('needsReview'), openedFrom, undefined)).toEqual({
      title: 'This server merges into main only reviewed branches',
      action: { kind: 'openMergeRequest', reviewId: 12, label: 'Open merge request' },
    });
  });

  it("opens the branch's merge request into that destination otherwise", () => {
    const reviews = [codeReviewSummary({ id: 9, mergeRequest: { state: 'Open', destination: '/main' } })];

    expect(mergeRuleNotice(refusal('needsReview'), undefined, reviews).action?.reviewId).toBe(9);
  });

  it('offers nothing to open when the branch has no merge request into that destination, or its reviews are not read yet', () => {
    expect(mergeRuleNotice(refusal('needsReview'), undefined, [])).toEqual({ title: 'This server merges into main only reviewed branches' });
    expect(mergeRuleNotice(refusal('needsReview'), undefined, undefined)).toEqual({ title: 'This server merges into main only reviewed branches' });
  });
});
