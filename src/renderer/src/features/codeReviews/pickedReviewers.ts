import type { MemberRef } from '@shared/domain/member';
import { NO_GROUPS, reviewerLabel } from './reviewerGroups';
import type { ReviewerPick } from './reviewerPick';

/*
 * The reviewers a new review or merge request asks (`ReviewersField`): picked with the review page's picker
 * (`ReviewerPicker`), shown as chips, each the kind it was listed with, so a group found by a search stays a group.
 */

/** Nobody picked yet: a new review has no reviewers to start from. */
export const NO_REVIEWERS: ReviewerPick = { onOpen: [], picked: [] };

/** A reviewer picked, as its chip shows them. */
export interface ReviewerChip {
  name: string;
  label: string;
  group: boolean;
}

/** What the field shows: a chip per reviewer, in the order picked, and Remove all once there are several. */
export interface PickedReviewers {
  chips: ReviewerChip[];
  removeAll: boolean;
}

export function pickedReviewersOf(pick: ReviewerPick): PickedReviewers {
  const chips = pick.picked.map((member) => ({ name: member.name, label: reviewerLabel(member, NO_GROUPS), group: member.kind === 'group' }));
  return { chips, removeAll: chips.length > 1 };
}

/** The reviewers to ask as the review is created (`--users`, `--groups`). */
export function reviewersToAsk(pick: ReviewerPick): MemberRef[] {
  return [...pick.picked];
}
