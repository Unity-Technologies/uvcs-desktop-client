import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';
import type { ReviewStatusOf } from '../../review/reviewStatus';

export type ReviewMarks = ReadonlyMap<string, ReviewMark>;

/** Files have contents to read; a folder has nothing to review. */
export function isReviewable(change: PendingChange): boolean {
  return change.itemType !== 'directory';
}

/** A pending file's mark tells by its contents whether it changed since the review. */
export function pendingReviewStatusOf(marks: ReviewMarks): ReviewStatusOf<PendingChange> {
  return (change) => (isReviewable(change) ? (marks.get(change.path)?.state ?? 'unreviewed') : null);
}
