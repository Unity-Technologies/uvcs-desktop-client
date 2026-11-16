import { describe, expect, it } from 'vitest';
import { pageTitle } from './pageTitle';

describe('pageTitle', () => {
  it('names a review page by its number, a merge request as one once known', () => {
    expect(pageTitle({ kind: 'codeReview', reviewId: 72 })).toBe('Code review 72');
    expect(pageTitle({ kind: 'codeReview', reviewId: 72 }, { mergeRequest: false })).toBe('Code review 72');
    expect(pageTitle({ kind: 'codeReview', reviewId: 72 }, { mergeRequest: true })).toBe('Merge request 72');
  });

  it('names the other pages as before', () => {
    expect(pageTitle({ kind: 'history', path: '/ws/src/player.cs' })).toBe('History of player.cs');
    expect(pageTitle({ kind: 'browseRepository', changesetId: 12 } as never)).toBe('Changeset 12');
  });
});
