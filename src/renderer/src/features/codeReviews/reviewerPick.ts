import type { CodeReviewer } from '@shared/domain/codeReview';
import type { MemberKind, MemberRef } from '@shared/domain/member';
import { isGroup, reviewerRef, type NamedReviewer, type ReviewerGroups } from './reviewerGroups';
import { offeredReviewers, type ServerMembers } from './reviewers';

/**
 * The reviewer picker's state while it's open: the reviewers as it opened, and who is checked. What it changes is
 * worked out against the reviewers it opened with, never the review as it reads later: someone another person added
 * while it was open isn't removed for not being checked. A reviewer it opened with is a group as `cm` typed them (the
 * review's page reads it), else as the server's groups say as it applies (they may still be read as it opens); someone
 * the user checks keeps the kind they were listed with (a group found by a search the server answered stays a group).
 */
export interface ReviewerPick {
  onOpen: readonly NamedReviewer[];
  picked: readonly MemberRef[];
}

/** What picking reviewers changes: the users and groups to add, and those to remove, named as `cm` writes them. */
export interface ReviewerChanges {
  add: MemberRef[];
  remove: MemberRef[];
}

/** The pick as the picker opens: the review's reviewers checked. */
export function startPick(reviewers: readonly CodeReviewer[], groups: ReviewerGroups): ReviewerPick {
  return { onOpen: reviewers.map(({ name, kind }) => ({ name, kind })), picked: reviewers.map((reviewer) => reviewerRef(reviewer, groups)) };
}

/** Whether `name` is checked, whatever its case. */
export function isPicked(pick: ReviewerPick, name: string): boolean {
  return pick.picked.some((member) => sameName(member.name, name));
}

/** Checks `member`, or unchecks them when checked. */
export function togglePicked(pick: ReviewerPick, member: MemberRef): ReviewerPick {
  const picked = isPicked(pick, member.name) ? pick.picked.filter((each) => !sameName(each.name, member.name)) : [...pick.picked, member];
  return { ...pick, picked };
}

/**
 * What the user's checks change: added who they checked, removed who they unchecked, from the reviewers as it opened,
 * each a group as `cm` typed them, or the server lists one by its name.
 */
export function pickChanges(pick: ReviewerPick, groups: ReviewerGroups): ReviewerChanges {
  return {
    add: pick.picked.filter((member) => !openedReviewer(pick, member.name)),
    remove: pick.onOpen.filter((reviewer) => !isPicked(pick, reviewer.name)).map((reviewer) => reviewerRef(reviewer, groups)),
  };
}

/** Whether the pick changes anyone: what a dialog's Save waits for. */
export function changesReviewers({ add, remove }: ReviewerChanges): boolean {
  return add.length > 0 || remove.length > 0;
}

/**
 * Whether a row is a user or a group: a reviewer it opened with as `cm` typed them or the server lists them; anyone
 * else checked as they were listed then (a group found by an earlier search may no longer be listed), or as listed.
 */
export function pickedKind(pick: ReviewerPick, name: string, groups: ReviewerGroups): MemberKind {
  const reviewer = openedReviewer(pick, name);
  const checked = reviewer ? undefined : pick.picked.find((member) => sameName(member.name, name));
  return checked?.kind ?? (isGroup(reviewer ?? { name }, groups) ? 'group' : 'user');
}

function openedReviewer(pick: ReviewerPick, name: string): NamedReviewer | undefined {
  return pick.onOpen.find((each) => sameName(each.name, name));
}

/**
 * The rows the picker offers: the reviewers as it opened, then whoever the user checked that the list no longer
 * returns (a server that can't list everyone answers only the last search: what will be applied stays in view), then
 * everyone else listed, groups before users. Checking someone listed never moves their row.
 */
export function pickOffered(pick: ReviewerPick, members: ServerMembers): string[] {
  const offered = offeredReviewers(members, pick.onOpen.map((reviewer) => reviewer.name));
  const inView = new Set(offered.map((name) => name.toLowerCase()));
  const checkedOutOfView = pick.picked.filter((member) => !inView.has(member.name.toLowerCase())).map((member) => member.name);
  return [...offered.slice(0, pick.onOpen.length), ...checkedOutOfView, ...offered.slice(pick.onOpen.length)];
}

/** Whether the picker can't list everyone and finds users and groups by what's typed instead (a directory with a size limit). */
export interface PickerListing {
  listFailed: boolean;
  loading: boolean;
  search: string;
}

/** What the picker says when it shows nobody. */
export function pickerEmptyText({ listFailed, loading, search }: PickerListing): string {
  if (loading) return 'Reading the users and groups…';
  if (listFailed && !search.trim()) return 'Type a name.';
  return `No one matches “${search.trim()}”`;
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
