import type { CodeReviewer } from '@shared/domain/codeReview';
import { reviewerChanges, type ReviewerChanges } from './reviewers';

/**
 * The reviewer picker's state while it's open: the reviewers as it opened, and who is checked. What it changes is
 * worked out against the reviewers it opened with, never the review as it reads later: someone another person added
 * while it was open isn't removed for not being checked.
 */
export interface ReviewerPick {
  onOpen: readonly CodeReviewer[];
  picked: readonly string[];
}

export function startPick(reviewers: readonly CodeReviewer[]): ReviewerPick {
  return { onOpen: reviewers, picked: reviewers.map((reviewer) => reviewer.name) };
}

/** Whether `user` is checked, whatever the case of their name. */
export function isPicked(pick: ReviewerPick, user: string): boolean {
  return pick.picked.some((name) => sameUser(name, user));
}

/** Checks `user`, or unchecks them when checked. */
export function togglePicked(pick: ReviewerPick, user: string): ReviewerPick {
  return { ...pick, picked: isPicked(pick, user) ? pick.picked.filter((name) => !sameUser(name, user)) : [...pick.picked, user] };
}

/** What the user's checks change: added who they checked, removed who they unchecked, from the reviewers as it opened. */
export function pickChanges(pick: ReviewerPick): ReviewerChanges {
  return reviewerChanges(pick.onOpen, pick.picked);
}

/** Whether the picker can't list everyone and finds users by what's typed instead (a directory with a size limit). */
export interface PickerListing {
  listFailed: boolean;
  loading: boolean;
  search: string;
}

/** What the picker says when it shows nobody. */
export function pickerEmptyText({ listFailed, loading, search }: PickerListing): string {
  if (loading) return 'Reading the users…';
  if (listFailed && !search.trim()) return 'Type a name.';
  return `No one matches “${search.trim()}”`;
}

function sameUser(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
