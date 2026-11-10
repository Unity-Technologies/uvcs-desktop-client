import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { Page } from '../navigation/pages';
import { isShownByCodeReviewPage } from './refreshScopes';

type QueryKey = readonly unknown[];

/**
 * What Refresh (⌘R, the menu's, a view's or page's button) reads again with this page in front. A code review's page
 * reads only what it shows (`isShownByCodeReviewPage`): someone keeps it open waiting for others' comments, and the
 * view under it, the top bar and the sidebar needn't ask the server again each time. Any other page, or none, refreshes
 * everything the window shows (undefined). `reviewTargetOf` tells what a review already read is of.
 */
export function pageRefreshScope(
  page: Page | undefined,
  reviewTargetOf: (reviewId: number) => CodeReviewTarget | undefined,
): ((key: QueryKey) => boolean) | undefined {
  if (page?.kind !== 'codeReview') return undefined;
  return isShownByCodeReviewPage(page.reviewId, reviewTargetOf(page.reviewId));
}
