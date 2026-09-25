import { useState, type ReactNode } from 'react';
import { saveSettings, useSettings } from '../../app/settings/useSettings';
import { ReviewBar } from './ReviewBar';
import { ReviewModeHint } from './ReviewModeHint';
import { announceReviewMode, setReviewMode } from './reviewModeSetting';
import { hasMark, needsReview, reviewProgress, shouldMarkReviewed, type ReviewStatusOf } from './reviewStatus';

/** What a list needs for review marks: whether they show, where each item stands, and the way to mark it. */
export interface ListReview<T> {
  /** Review mode is a per-workspace choice, off at first: without it the list shows no marks at all. */
  on: boolean;
  /** Where each item stands as shown: outside review mode nothing is marked, though the stored marks are kept for when it's back. */
  statusOf: ReviewStatusOf<T>;
  /** Marks the items reviewed, or clears their marks when all of them are reviewed. Outside review mode, turns it on and marks them. */
  toggle: (items: T[]) => void;
}

export interface ReviewMode<T> extends ListReview<T> {
  /** Leaves out what's reviewed while the "Unreviewed" filter is on. */
  narrow: (items: T[]) => T[];
  showAll: () => void;
  /** Above the list: the progress and actions in review mode, or the one-time offer to turn it on. */
  bar: ReactNode;
}

interface ReviewModeOptions<T> {
  workspacePath: string;
  items: readonly T[];
  /** Where each item stands by its stored mark. */
  statusOf: ReviewStatusOf<T>;
  setReviewed: (items: T[], reviewed: boolean) => void;
  /** Offers review mode, once ever, while it's off: e.g. after a burst of changes. */
  offer?: boolean;
}

/** Review marks on a list of files, shared by every list that shows diffs: what's reviewed, what changed since, and the filter for what's left. */
export function useReviewMode<T>({ workspacePath, items, statusOf: storedStatusOf, setReviewed, offer = false }: ReviewModeOptions<T>): ReviewMode<T> {
  const { reviewModeWorkspaces, reviewModeHintDone } = useSettings();
  const on = reviewModeWorkspaces.includes(workspacePath);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const statusOf: ReviewStatusOf<T> = on ? storedStatusOf : (item) => storedStatusOf(item) && 'unreviewed';
  const progress = reviewProgress(items, statusOf);
  const filtering = on && onlyUnreviewed;

  const toggle = (selected: T[]): void => {
    const reviewable = selected.filter((item) => statusOf(item) !== null);
    if (reviewable.length === 0) return;
    if (on) {
      setReviewed(reviewable, shouldMarkReviewed(reviewable, statusOf));
      return;
    }
    void setReviewMode(workspacePath, true);
    announceReviewMode(workspacePath);
    setReviewed(reviewable, true);
  };

  const hint = offer && !reviewModeHintDone && progress.total > 0 && (
    <ReviewModeHint onTurnOn={() => void setReviewMode(workspacePath, true)} onDismiss={() => void saveSettings({ reviewModeHintDone: true })} />
  );

  return {
    on,
    statusOf,
    toggle,
    narrow: (shown) => (filtering ? shown.filter((item) => needsReview(statusOf, item)) : shown),
    showAll: () => setOnlyUnreviewed(false),
    bar: on
      ? progress.total > 0 && (
          <ReviewBar
            progress={progress}
            onlyUnreviewed={onlyUnreviewed}
            onOnlyUnreviewedChange={setOnlyUnreviewed}
            onMarkAll={() => setReviewed(items.filter((item) => needsReview(statusOf, item)), true)}
            onClearMarks={() => setReviewed(items.filter((item) => hasMark(statusOf, item)), false)}
            hasMarks={items.some((item) => hasMark(statusOf, item))}
            onLeave={() => void setReviewMode(workspacePath, false)}
          />
        )
      : hint,
  };
}
