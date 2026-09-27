import { describe, expect, it } from 'vitest';
import { codeReviewsEmptyState } from './codeReviewsEmptyState';

describe('codeReviewsEmptyState', () => {
  it('offers a new review only when nothing narrows the list', () => {
    expect(codeReviewsEmptyState({ searching: false, filtered: false })).toMatchObject({ title: 'No code reviews', action: 'newReview' });
  });

  it('tells text and filters that match nothing apart, and offers to clear them', () => {
    expect(codeReviewsEmptyState({ searching: true, filtered: true })).toMatchObject({ title: 'No matching code reviews', action: 'clearFilters' });
    expect(codeReviewsEmptyState({ searching: false, filtered: true })).toMatchObject({ title: 'No code reviews match these filters', action: 'clearFilters' });
  });
});
