import { useState, type ReactNode } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { ReviewBar } from './ReviewBar';
import { setReviewed } from './reviewOperations';
import { isReviewable, needsReview, reviewProgress, shouldMarkReviewed, type ReviewMarks } from './reviewProgress';
import { useReviewMarks } from './useReviewMarks';

interface ReviewMode {
  marks: ReviewMarks;
  /** Leaves out what's reviewed while the "Unreviewed" filter is on. */
  narrow: (changes: PendingChange[]) => PendingChange[];
  showAll: () => void;
  /** Marks the changes reviewed, or clears their marks when all of them are reviewed. */
  toggle: (changes: PendingChange[]) => void;
  /** Progress and actions above the list; nothing when there is nothing to review. */
  bar: ReactNode;
}

/** Review marks on the pending changes: what's reviewed, what changed since, and the filter for what's left. */
export function useReviewMode(workspacePath: string, allChanges: PendingChange[], settled: boolean): ReviewMode {
  const marks = useReviewMarks(workspacePath, allChanges, settled);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const progress = reviewProgress(allChanges, marks);

  const toggle = (changes: PendingChange[]): void => {
    const reviewable = changes.filter(isReviewable);
    void setReviewed(workspacePath, reviewable.map((change) => change.path), shouldMarkReviewed(reviewable, marks));
  };

  return {
    marks,
    narrow: (changes) => (onlyUnreviewed ? changes.filter((change) => needsReview(marks, change)) : changes),
    showAll: () => setOnlyUnreviewed(false),
    toggle,
    bar: progress.total > 0 && (
      <ReviewBar
        progress={progress}
        onlyUnreviewed={onlyUnreviewed}
        onOnlyUnreviewedChange={setOnlyUnreviewed}
        onMarkAll={() => void setReviewed(workspacePath, allChanges.filter((change) => needsReview(marks, change)).map((change) => change.path), true)}
        onClearMarks={() => void setReviewed(workspacePath, [...marks.keys()], false)}
        hasMarks={marks.size > 0}
      />
    ),
  };
}
