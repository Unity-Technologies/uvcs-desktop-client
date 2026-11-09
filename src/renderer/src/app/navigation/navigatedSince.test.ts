import { describe, expect, it } from 'vitest';
import { navigatedSince } from './navigatedSince';
import type { Page } from './pages';

const review: Page = { kind: 'codeReview', reviewId: 41, tab: 'changes' };

describe('navigatedSince', () => {
  it('stays while the window shows what it showed', () => {
    expect(navigatedSince({ view: 'codeReviews', top: review }, { view: 'codeReviews', top: review })).toBe(false);
  });

  it('goes once a page opens over it, the page on top moves, or the view changes', () => {
    const history: Page = { kind: 'history', path: '/src/Player.cs', view: 'annotate' };
    expect(navigatedSince({ view: 'codeReviews', top: review }, { view: 'codeReviews', top: history })).toBe(true);
    expect(navigatedSince({ view: 'codeReviews', top: review }, { view: 'codeReviews', top: { ...review, tab: 'conversation' } })).toBe(true);
    expect(navigatedSince({ view: 'codeReviews', top: review }, { view: 'changes', top: review })).toBe(true);
    expect(navigatedSince({ view: 'codeReviews', top: review }, { view: 'codeReviews', top: undefined })).toBe(true);
  });
});
