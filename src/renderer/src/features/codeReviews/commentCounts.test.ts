import { describe, expect, it } from 'vitest';
import { commentCountsSortValue, commentCountsText } from './commentCounts';

describe('commentCountsText', () => {
  it('counts the comments and says how many are open', () => {
    expect(commentCountsText({ commentCount: 12, openIssueCount: 2 })).toBe('12 comments, 2 open');
  });

  it('says one comment, and leaves out the open ones when none is', () => {
    expect(commentCountsText({ commentCount: 1, openIssueCount: 0 })).toBe('1 comment');
    expect(commentCountsText({ commentCount: 0, openIssueCount: 0 })).toBe('0 comments');
  });
});

describe('commentCountsSortValue', () => {
  it('puts a review with anything open before one with more comments but none open', () => {
    expect(commentCountsSortValue({ commentCount: 1, openIssueCount: 1 })).toBeGreaterThan(commentCountsSortValue({ commentCount: 900, openIssueCount: 0 }));
  });

  it('then sorts by the number of comments', () => {
    expect(commentCountsSortValue({ commentCount: 5, openIssueCount: 1 })).toBeGreaterThan(commentCountsSortValue({ commentCount: 4, openIssueCount: 1 }));
  });
});
