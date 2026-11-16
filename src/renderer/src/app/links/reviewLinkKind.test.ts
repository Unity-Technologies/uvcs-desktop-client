import { describe, expect, it } from 'vitest';
import { withReviewKind } from './reviewLinkKind';

describe('the word a link to a review is written with', () => {
  const isMergeRequest = (id: number) => id === 12;

  it('names a review known to be a merge request as one, the file it shows kept', () => {
    expect(withReviewKind({ object: { kind: 'codeReview', id: 12 }, page: { kind: 'browse', path: '/a.cs' } }, isMergeRequest)).toEqual({
      object: { kind: 'codeReview', id: 12, asMergeRequest: true },
      page: { kind: 'browse', path: '/a.cs' },
    });
  });

  it('leaves a code review, another object, and a link that already says, as they are', () => {
    const review = { object: { kind: 'codeReview', id: 5 } } as const;
    const branch = { object: { kind: 'branch', name: '/main' } } as const;
    const said = { object: { kind: 'codeReview', id: 5, asMergeRequest: true } } as const;
    expect([withReviewKind(review, isMergeRequest), withReviewKind(branch, isMergeRequest), withReviewKind(said, isMergeRequest)]).toEqual([review, branch, said]);
  });
});
