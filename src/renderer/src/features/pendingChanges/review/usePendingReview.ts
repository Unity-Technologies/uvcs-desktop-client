import { useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { useReviewMode, type ReviewMode } from '../../review/useReviewMode';
import { pendingReviewStatusOf, type ReviewMarks } from './pendingReviewStatus';
import { setReviewed } from './reviewOperations';
import { useChangeBurst } from './useChangeBurst';
import { useReviewMarks } from './useReviewMarks';

const NO_MARKS: ReviewMarks = new Map();

export interface PendingReview extends ReviewMode<PendingChange> {
  /** The marks shown, with what the diff needs to show the changes since the review: none outside review mode. */
  marks: ReviewMarks;
}

/** Review mode on the pending changes; a burst of changes (an agent at work) offers it. */
export function usePendingReview(workspacePath: string, allChanges: PendingChange[], settled: boolean): PendingReview {
  const marks = useReviewMarks(workspacePath, allChanges, settled);
  const statusOf = useMemo(() => pendingReviewStatusOf(marks), [marks]);
  const burst = useChangeBurst(workspacePath, allChanges, settled);
  const review = useReviewMode({
    workspacePath,
    items: allChanges,
    statusOf,
    setReviewed: (changes, reviewed) => void setReviewed(workspacePath, changes.map((change) => change.path), reviewed),
    offer: burst,
  });
  return { ...review, marks: review.on ? marks : NO_MARKS };
}
