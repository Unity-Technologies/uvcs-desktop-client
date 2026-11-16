import type { MemberRef } from '@shared/domain/member';
import { NO_GROUPS, reviewerLabel } from './reviewerGroups';
import type { ReviewerPick } from './reviewerPick';

/*
 * The reviewers a new review or merge request asks (`ReviewersField`): picked with the review page's picker
 * (`ReviewerPicker`), shown as chips, each the kind it was listed with, so a group found by a search stays a group.
 */

/** Nobody picked yet: a new review has no reviewers to start from. */
export const NO_REVIEWERS: ReviewerPick = { onOpen: [], picked: [] };

/** A reviewer picked, as its chip shows them; its × takes `member` off. */
export interface ReviewerChip {
  member: MemberRef;
  label: string;
  group: boolean;
}

/**
 * What the field shows: a chip per reviewer, in the order picked, Remove all once there are several, and the hint that
 * reviewers are optional while there are none.
 */
export interface PickedReviewers {
  chips: ReviewerChip[];
  removeAll: boolean;
  hint: boolean;
}

export function pickedReviewersOf(pick: ReviewerPick): PickedReviewers {
  const chips = pick.picked.map((member) => ({ member, label: reviewerLabel(member, NO_GROUPS), group: member.kind === 'group' }));
  return { chips, removeAll: chips.length > 1, hint: chips.length === 0 };
}

/**
 * Where the keyboard goes once the chip at `index` of `count` is removed: the × of the chip that takes its place, or
 * Add when it was the last one.
 */
export function focusAfterRemoving(index: number, count: number): number | 'add' {
  return index < count - 1 ? index : 'add';
}

/** The reviewers to ask as the review is created (`--users`, `--groups`). */
export function reviewersToAsk(pick: ReviewerPick): MemberRef[] {
  return [...pick.picked];
}
