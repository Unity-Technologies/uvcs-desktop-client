import type { KeyboardEvent } from 'react';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import type { ListReview } from './useReviewMode';
import { reviewableOf, shouldMarkReviewed, type ReviewStatusOf } from './reviewStatus';

/** The rows R moves through: the list's, the focused row's index in them, and how the list moves its selection. */
export interface ReviewKeyList<T> {
  rows: readonly GroupedTreeRow<T, unknown>[];
  focusedIndex: number;
  moveBy: (step: number) => void;
}

/** R, alone, on a list of files. */
export function isReviewKey(event: KeyboardEvent): boolean {
  return event.key === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

/**
 * R toggles the selection's marks. Marking one file moves on to the next file to review, so a review goes R, R, R
 * down the list, never stopping on a row R can't mark.
 */
export function toggleReviewedFromKey<T>(review: ListReview<T>, selected: T[], list: ReviewKeyList<T>): void {
  const reviewable = reviewableOf(selected, review.statusOf);
  if (reviewable.length === 0) return;
  const advance = reviewable.length === 1 && shouldMarkReviewed(reviewable, review.statusOf);
  review.toggle(reviewable);
  if (!advance) return;
  const step = stepToNextReviewable(list.rows, list.focusedIndex, review.statusOf);
  if (step !== null) list.moveBy(step);
}

/**
 * How many rows down the next one R can mark is: a file with something to review, or a closed folder or group holding
 * one. It passes directories (nothing to review) and open folders and groups (their files come next). Null when
 * none is left below.
 */
export function stepToNextReviewable<T>(rows: readonly GroupedTreeRow<T, unknown>[], fromIndex: number, statusOf: ReviewStatusOf<T>): number | null {
  for (let index = fromIndex + 1; index < rows.length; index++) {
    if (holdsReview(rows[index]!, statusOf)) return index - fromIndex;
  }
  return null;
}

function holdsReview<T>(row: GroupedTreeRow<T, unknown>, statusOf: ReviewStatusOf<T>): boolean {
  if (row.type === 'file') return statusOf(row.item) !== null;
  return row.collapsed && reviewableOf(row.items, statusOf).length > 0;
}
