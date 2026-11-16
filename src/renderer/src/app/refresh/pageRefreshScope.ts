import type { CodeReview } from '@shared/domain/codeReview';
import type { Page } from '../navigation/pages';
import { isShownByCodeReviewPage } from './refreshScopes';

type QueryKey = readonly unknown[];

/**
 * What Refresh (⌘R, the menu's, a view's or page's button) reads again with this page in front. A code review's page
 * reads only what it shows (`isShownByCodeReviewPage`): someone keeps it open waiting for others' comments, and the
 * view under it, the top bar and the sidebar needn't ask the server again each time. Any other page, or none, refreshes
 * everything the window shows (undefined). `reviewOf` gives the review already read: what it's of, where it merges;
 * `conflictsChecked` whether a request from a branch had its conflicts checked (`refreshedDestinationOf`).
 */
export function pageRefreshScope(
  page: Page | undefined,
  reviewOf: (reviewId: number) => Pick<CodeReview, 'target' | 'mergeRequest'> | undefined,
  conflictsChecked: (source: string) => boolean,
): ((key: QueryKey) => boolean) | undefined {
  if (page?.kind !== 'codeReview') return undefined;
  const review = reviewOf(page.reviewId);
  return isShownByCodeReviewPage(page.reviewId, review?.target, review && refreshedDestinationOf(review, conflictsChecked));
}

/**
 * The destination branch a review's page reads again on Refresh: an open merge request's, once its conflicts were
 * checked, as its head keys the check (`useMergeRequestConflicts`), so a check-in there checks them again. None
 * otherwise: a Refresh costs no branch read for a check nobody asked.
 */
export function refreshedDestinationOf(review: Pick<CodeReview, 'target' | 'mergeRequest'>, conflictsChecked: (source: string) => boolean): string | undefined {
  const { target, mergeRequest } = review;
  if (mergeRequest?.state !== 'Open' || target.kind !== 'branch') return undefined;
  return conflictsChecked(target.branch) ? mergeRequest.destination : undefined;
}
