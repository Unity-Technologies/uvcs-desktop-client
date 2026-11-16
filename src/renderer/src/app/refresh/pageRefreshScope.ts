import type { CodeReview } from '@shared/domain/codeReview';
import type { Page } from '../navigation/pages';
import { isShownByCodeReviewPage } from './refreshScopes';

type QueryKey = readonly unknown[];

/**
 * What Refresh (⌘R, the menu's, a view's or page's button) reads again with this page in front. A code review's page
 * reads only what it shows (`isShownByCodeReviewPage`): someone keeps it open waiting for others' comments, and the
 * view under it, the top bar and the sidebar needn't ask the server again each time. Any other page, or none, refreshes
 * everything the window shows (undefined). `reviewOf` gives the review already read: what it's of, where it merges.
 */
export function pageRefreshScope(
  page: Page | undefined,
  reviewOf: (reviewId: number) => Pick<CodeReview, 'target' | 'mergeRequest'> | undefined,
): ((key: QueryKey) => boolean) | undefined {
  if (page?.kind !== 'codeReview') return undefined;
  const review = reviewOf(page.reviewId);
  return isShownByCodeReviewPage(page.reviewId, review?.target, review?.mergeRequest?.destination);
}
