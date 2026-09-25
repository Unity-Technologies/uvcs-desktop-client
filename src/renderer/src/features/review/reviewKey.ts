import type { KeyboardEvent } from 'react';
import type { ListReview } from './useReviewMode';
import { shouldMarkReviewed } from './reviewStatus';

/** R, alone, on a list of files. */
export function isReviewKey(event: KeyboardEvent): boolean {
  return event.key === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

/** R toggles the selection's marks. Marking one file moves on to the next, so a review goes R, R, R down the list. */
export function toggleReviewedFromKey<T>(review: ListReview<T>, selected: T[], moveToNext: () => void): void {
  const reviewable = selected.filter((item) => review.statusOf(item) !== null);
  if (reviewable.length === 0) return;
  const advance = reviewable.length === 1 && shouldMarkReviewed(reviewable, review.statusOf);
  review.toggle(reviewable);
  if (advance) moveToNext();
}
