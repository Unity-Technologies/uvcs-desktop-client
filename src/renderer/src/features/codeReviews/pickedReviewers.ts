import type { MemberRef } from '@shared/domain/member';
import { sameUser } from '../../lib/userName';
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
  /** A user's name as the server knows them (often an email), when the label shows another; none for a group. */
  tip?: string;
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
  const chips = pick.picked.map((member) => chipOf(member));
  return { chips, removeAll: chips.length > 1, hint: chips.length === 0 };
}

/**
 * The pick as the picker opens: those already picked are the reviewers it opened with, so they lead its list, checked,
 * and stay where they are while the user checks and unchecks, as on the review page (`pickOffered`).
 */
export function pickAsPickerOpens(pick: ReviewerPick): ReviewerPick {
  return { onOpen: pick.picked, picked: pick.picked };
}

function chipOf(member: MemberRef): ReviewerChip {
  const label = reviewerLabel(member, NO_GROUPS);
  const group = member.kind === 'group';
  return group || sameUser(label, member.name) ? { member, label, group } : { member, label, group, tip: member.name };
}

/**
 * Where the keyboard goes once the chip at `index` of `count` is removed: the × of the chip that takes its place, or
 * the button that opens the picker when it was the last one.
 */
export function focusAfterRemoving(index: number, count: number): number | 'picker' {
  return index < count - 1 ? index : 'picker';
}

/** The reviewers to ask as the review is created (`--users`, `--groups`). */
export function reviewersToAsk(pick: ReviewerPick): MemberRef[] {
  return [...pick.picked];
}
