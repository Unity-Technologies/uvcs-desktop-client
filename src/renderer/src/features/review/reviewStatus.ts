export type ReviewStatus = 'unreviewed' | 'reviewed' | 'changedSinceReview';

/** How a list tells where each item stands; null for items with nothing to review, such as folders. */
export type ReviewStatusOf<T> = (item: T) => ReviewStatus | null;

/**
 * Where each item stands as a list shows it: its stored mark in review mode; outside it every file shows unreviewed,
 * though the stored marks are kept for when it's back.
 */
export function shownStatusOf<T>(storedStatusOf: ReviewStatusOf<T>, reviewModeOn: boolean): ReviewStatusOf<T> {
  return reviewModeOn ? storedStatusOf : (item) => (storedStatusOf(item) === null ? null : 'unreviewed');
}

/** Still to look at: never reviewed, or changed since. */
export function needsReview<T>(statusOf: ReviewStatusOf<T>, item: T): boolean {
  const status = statusOf(item);
  return status !== null && status !== 'reviewed';
}

/** Reviewed once, whether or not it changed since: it has a mark to clear. */
export function hasMark<T>(statusOf: ReviewStatusOf<T>, item: T): boolean {
  const status = statusOf(item);
  return status === 'reviewed' || status === 'changedSinceReview';
}

export interface ReviewProgress {
  total: number;
  reviewed: number;
}

/** The items with something to review: files, not folders. */
export function reviewableOf<T>(items: readonly T[], statusOf: ReviewStatusOf<T>): T[] {
  return items.filter((item) => statusOf(item) !== null);
}

export function reviewProgress<T>(items: readonly T[], statusOf: ReviewStatusOf<T>): ReviewProgress {
  const reviewable = reviewableOf(items, statusOf);
  return { total: reviewable.length, reviewed: reviewable.filter((item) => statusOf(item) === 'reviewed').length };
}

/** Toggling a selection marks it all reviewed, unless all of it already is: then it clears the marks. */
export function shouldMarkReviewed<T>(items: readonly T[], statusOf: ReviewStatusOf<T>): boolean {
  return items.some((item) => needsReview(statusOf, item));
}

/** A folder's mark: reviewed once every file in it is; null when it holds nothing to review. */
export function groupReviewStatus<T>(items: readonly T[], statusOf: ReviewStatusOf<T>): ReviewStatus | null {
  const { total, reviewed } = reviewProgress(items, statusOf);
  if (total === 0) return null;
  return reviewed === total ? 'reviewed' : 'unreviewed';
}
