import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';

export type ReviewStatus = 'unreviewed' | ReviewMark['state'];

export type ReviewMarks = ReadonlyMap<string, ReviewMark>;

/** Files have contents to read; a folder has nothing to review. */
export function isReviewable(change: PendingChange): boolean {
  return change.itemType !== 'directory';
}

export function reviewStatus(marks: ReviewMarks, change: PendingChange): ReviewStatus {
  return marks.get(change.path)?.state ?? 'unreviewed';
}

/** Still to look at: never reviewed, or changed since. */
export function needsReview(marks: ReviewMarks, change: PendingChange): boolean {
  return isReviewable(change) && reviewStatus(marks, change) !== 'reviewed';
}

/** Changed since the review, with a copy of the reviewed text to compare against. */
export function hasChangesSinceReview(marks: ReviewMarks, change: PendingChange): boolean {
  const mark = marks.get(change.path);
  return mark?.state === 'changedSinceReview' && mark.hasSnapshot;
}

export interface ReviewProgress {
  total: number;
  reviewed: number;
}

export function reviewProgress(changes: PendingChange[], marks: ReviewMarks): ReviewProgress {
  const reviewable = changes.filter(isReviewable);
  return { total: reviewable.length, reviewed: reviewable.filter((change) => !needsReview(marks, change)).length };
}

/** Toggling a selection marks it all reviewed, unless all of it already is: then it clears the marks. */
export function shouldMarkReviewed(changes: PendingChange[], marks: ReviewMarks): boolean {
  return changes.some((change) => needsReview(marks, change));
}
