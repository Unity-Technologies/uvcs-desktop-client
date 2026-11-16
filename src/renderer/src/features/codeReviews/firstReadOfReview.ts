import { matchQuery, type QueryClient } from '@tanstack/react-query';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

/**
 * Calls `onRead` once with review `reviewId`, from the first read of the place's reviews that holds it: a list, a
 * branch's reviews, the review's own page. It runs no read of its own: it waits for those an operation's refresh makes
 * anyway (a new merge request's, `createdAs`). Returns what stops watching.
 */
export function onFirstReadOfReview(client: QueryClient, place: Place, reviewId: number, onRead: (review: CodeReviewSummary) => void): () => void {
  const reviews = { queryKey: queryKeys.inPlace(place, 'codeReviews') };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || !matchQuery(reviews, event.query)) return;
    const review = reviewIn(event.query.state.data, reviewId);
    if (!review) return;
    unsubscribe();
    onRead(review);
  });
  return unsubscribe;
}

/** The review in what a reviews' query read: a list of them or one alone; none in the area's other reads (reviewers, a subscription). */
function reviewIn(data: unknown, reviewId: number): CodeReviewSummary | undefined {
  const candidates = Array.isArray(data) ? data : [data];
  return candidates.find((each): each is CodeReviewSummary => isReview(each) && each.id === reviewId);
}

function isReview(value: unknown): value is CodeReviewSummary {
  return typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'reviewers' in value;
}
