import { useState, type ReactNode } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { saveSettings, useSettings } from '../../../app/settings/useSettings';
import { ReviewBar } from './ReviewBar';
import { ReviewModeHint } from './ReviewModeHint';
import { announceReviewMode, setReviewMode } from './reviewModeSetting';
import { setReviewed } from './reviewOperations';
import { isReviewable, needsReview, reviewProgress, shouldMarkReviewed, type ReviewMarks } from './reviewProgress';
import { useChangeBurst } from './useChangeBurst';
import { useReviewMarks } from './useReviewMarks';

const NO_MARKS: ReviewMarks = new Map();

interface ReviewMode {
  /** Review mode is a per-workspace choice, off at first: without it the list shows no marks at all. */
  on: boolean;
  /** The marks to show: none outside review mode, though the stored ones are kept for when it's back. */
  marks: ReviewMarks;
  /** Leaves out what's reviewed while the "Unreviewed" filter is on. */
  narrow: (changes: PendingChange[]) => PendingChange[];
  showAll: () => void;
  /** Marks the changes reviewed, or clears their marks when all of them are reviewed. Outside review mode, turns it on and marks them. */
  toggle: (changes: PendingChange[]) => void;
  /** Above the list: the progress and actions in review mode, or the one-time offer to turn it on after a burst of changes. */
  bar: ReactNode;
}

/** Review marks on the pending changes: what's reviewed, what changed since, and the filter for what's left. */
export function useReviewMode(workspacePath: string, allChanges: PendingChange[], settled: boolean): ReviewMode {
  const { reviewModeWorkspaces, reviewModeHintDone } = useSettings();
  const on = reviewModeWorkspaces.includes(workspacePath);
  const storedMarks = useReviewMarks(workspacePath, allChanges, settled);
  const marks = on ? storedMarks : NO_MARKS;
  const burst = useChangeBurst(workspacePath, allChanges, settled);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const progress = reviewProgress(allChanges, marks);
  const filtering = on && onlyUnreviewed;

  const toggle = (changes: PendingChange[]): void => {
    const paths = changes.filter(isReviewable).map((change) => change.path);
    if (on) {
      void setReviewed(workspacePath, paths, shouldMarkReviewed(changes.filter(isReviewable), marks));
      return;
    }
    void setReviewMode(workspacePath, true);
    announceReviewMode(workspacePath);
    void setReviewed(workspacePath, paths, true);
  };

  const hint = !on && burst && !reviewModeHintDone && progress.total > 0 && (
    <ReviewModeHint onTurnOn={() => void setReviewMode(workspacePath, true)} onDismiss={() => void saveSettings({ reviewModeHintDone: true })} />
  );

  return {
    on,
    marks,
    narrow: (changes) => (filtering ? changes.filter((change) => needsReview(marks, change)) : changes),
    showAll: () => setOnlyUnreviewed(false),
    toggle,
    bar: on
      ? progress.total > 0 && (
          <ReviewBar
            progress={progress}
            onlyUnreviewed={onlyUnreviewed}
            onOnlyUnreviewedChange={setOnlyUnreviewed}
            onMarkAll={() => void setReviewed(workspacePath, allChanges.filter((change) => needsReview(marks, change)).map((change) => change.path), true)}
            onClearMarks={() => void setReviewed(workspacePath, [...marks.keys()], false)}
            hasMarks={marks.size > 0}
            onLeave={() => void setReviewMode(workspacePath, false)}
          />
        )
      : hint,
  };
}
