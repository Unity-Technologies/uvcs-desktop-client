import type { Changeset } from '@shared/domain/changeset';
import { commentLineText } from '../../lib/comments/commentText';
import { formatDateTime, formatShortDay, type DayFormat } from '../../lib/formatDate';
import { displayName } from '../../lib/userName';

/**
 * Where the user left off reviewing the branch, as the "Changeset by changeset" list reads it: a code review's
 * checkpoint (`ReviewCheckpoint`, features/codeReviews/rounds), when the user gave their status, and the newest
 * changeset on the branch then (none when they gave it before the branch's first changeset).
 */
export interface ReviewedUpTo {
  date: string;
  changesetId?: number;
  /** Whose review it is: none for the user's own; a reviewer's name when the user gave none (the author). */
  by?: string;
}

/** How a changeset's row is marked: new to the user since they reviewed, reviewed by them, or not at all before. */
export type ChangesetMark = 'new' | 'reviewed' | null;

/** Changeset numbers grow with time in a repository: one past the changeset reviewed up to came after the review. */
export function changesetMark(changeset: Pick<Changeset, 'id'>, reviewedUpTo: ReviewedUpTo | undefined): ChangesetMark {
  if (!reviewedUpTo) return null;
  return reviewedUpTo.changesetId === undefined || changeset.id > reviewedUpTo.changesetId ? 'new' : 'reviewed';
}

/** The changesets new to the user, in the order given; none before they reviewed. What the list's New toggle keeps. */
export function newChangesetsOf(changesets: readonly Changeset[], reviewedUpTo: ReviewedUpTo | undefined): Changeset[] {
  return changesets.filter((changeset) => changesetMark(changeset, reviewedUpTo) === 'new');
}

/** The line between the new changesets and the reviewed ones: above which row, its words, and its tooltip. */
export interface ReviewedSeparator {
  beforeKey: string;
  label: string;
  tip: string;
}

/**
 * "Reviewed by you · Nov 9", between what the user reviewed and what's new since, in the list `shown` (oldest first,
 * `oldestFirst`): before the first new changeset, under the reviewed ones. None before they reviewed, or with nothing
 * on one side of it to tell apart.
 */
export function reviewedSeparator(shown: readonly Changeset[], reviewedUpTo: ReviewedUpTo | undefined, now: number, format: DayFormat = {}): ReviewedSeparator | undefined {
  if (!reviewedUpTo) return undefined;
  const firstNew = shown.findIndex((changeset) => changesetMark(changeset, reviewedUpTo) === 'new');
  if (firstNew < 1 || changesetMark(shown[firstNew - 1]!, reviewedUpTo) !== 'reviewed') return undefined;
  const first = shown[firstNew]!;
  return { beforeKey: String(first.id), label: `Reviewed by ${reviewedUpTo.by === undefined ? 'you' : displayName(reviewedUpTo.by)} · ${formatShortDay(reviewedUpTo.date, now, format)}`, tip: formatDateTime(reviewedUpTo.date) };
}

/** What the New toggle keeps, in its tooltip: since whose last review. */
export function newToggleTip(reviewedUpTo: Pick<ReviewedUpTo, 'by'>): string {
  return `Only the changesets new since ${reviewedUpTo.by === undefined ? 'your' : `${displayName(reviewedUpTo.by)}'s`} last review`;
}

/** A row's tooltip: the comment's first line, then who, when (in full) and which changeset, which the row says shortly. */
export function changesetRowTip(changeset: Changeset): { text: string; sub: string } {
  return {
    text: commentLineText(changeset.comment) || 'No comment',
    sub: `${displayName(changeset.owner)} · ${formatDateTime(changeset.date)} · cs:${changeset.id}`,
  };
}
