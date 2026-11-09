import type { Page } from './pages';

/**
 * Whether opening `page` moves the page on top within itself rather than stacking another: a place in the review it
 * shows (a comment's file from its conversation, a link to it), as its tabs move (`navigation.replacePage`). Stacked,
 * the breadcrumb read "Code review 41 / Code review 41" and the review drew again, its conversation's scroll and
 * folds lost. Only a review's: the other pages are each a place to come back to (another file of a diff, another
 * folder of a repository), which Back returns to.
 */
export function movesWithinTop(top: Page | undefined, page: Page): boolean {
  return top?.kind === 'codeReview' && page.kind === 'codeReview' && top.reviewId === page.reviewId;
}
