import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';
import type { ReviewStatusOf } from '../../review/reviewStatus';
import { isCheckinCandidate } from '../changeCategories';

export type ReviewMarks = ReadonlyMap<string, ReviewMark>;

/** Files have contents to read; a folder has nothing to review, nor do ignored, cloaked or hidden files: they aren't checked in. */
export function isReviewable(change: PendingChange): boolean {
  return change.itemType !== 'directory' && isCheckinCandidate(change);
}

/** A pending file's mark tells by its contents whether it changed since the review. */
export function pendingReviewStatusOf(marks: ReviewMarks): ReviewStatusOf<PendingChange> {
  return (change) => (isReviewable(change) ? (marks.get(change.path)?.state ?? 'unreviewed') : null);
}
