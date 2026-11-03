import { useMemo } from 'react';
import { workspacePlace } from '@shared/domain/place';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { withMetas } from '../../../lib/unityMetaPairs';
import { pairedReviewStatusOf } from '../../review/reviewStatus';
import { useReviewMode, type ReviewMode } from '../../review/useReviewMode';
import { pairPendingMetas } from '../pendingMetaPairs';
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
  // A Unity asset and its `.meta` are one row to review: marked together, counted once.
  const pairs = useMemo(() => pairPendingMetas(allChanges), [allChanges]);
  const statusOf = useMemo(() => pairedReviewStatusOf(pendingReviewStatusOf(marks), pairs), [marks, pairs]);
  const burst = useChangeBurst(workspacePath, allChanges, settled);
  const review = useReviewMode({
    place: workspacePlace(workspacePath),
    items: allChanges,
    statusOf,
    setReviewed: (changes, reviewed) => void setReviewed(workspacePath, withMetas(changes, pairs.metaOf).map((change) => change.path), reviewed),
    offer: burst,
  });
  return { ...review, marks: review.on ? marks : NO_MARKS };
}
