import { useQuery } from '@tanstack/react-query';
import { codeReviewQuery } from '../../features/codeReviews/useCodeReviews';
import { reviewNoun } from '../../features/codeReviews/mergeRequestState';
import { usePlace } from '../workspace/useWorkspace';
import type { Page } from './pages';
import { pageTitle } from './pageTitle';

/**
 * A page's name (`pageTitle`), a review page's as a merge request once its review says it is one. It reads nothing:
 * it follows the review the page reads (or a list read already), under the same key, never asking for it itself.
 */
export function usePageTitle(page: Page): string;
export function usePageTitle(page: Page | undefined): string | undefined;
export function usePageTitle(page: Page | undefined): string | undefined {
  const reviewId = page?.kind === 'codeReview' ? page.reviewId : -1;
  const { data: review } = useQuery({ ...codeReviewQuery(usePlace(), reviewId), enabled: false });
  if (!page) return undefined;
  return pageTitle(page, { mergeRequest: page.kind === 'codeReview' && review !== undefined && reviewNoun(review) === 'Merge request' });
}
