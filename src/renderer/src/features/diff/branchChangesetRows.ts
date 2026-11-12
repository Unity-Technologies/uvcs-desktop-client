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
 * "Reviewed by you · Nov 9", above the first reviewed changeset `shown` (newest first): what's below it the user
 * reviewed. None before they reviewed, or when no reviewed changeset shows.
 */
export function reviewedSeparator(shown: readonly Changeset[], reviewedUpTo: ReviewedUpTo | undefined, now: number, format: DayFormat = {}): ReviewedSeparator | undefined {
  const first = shown.find((changeset) => changesetMark(changeset, reviewedUpTo) === 'reviewed');
  if (!first || !reviewedUpTo) return undefined;
  return { beforeKey: String(first.id), label: `Reviewed by you · ${formatShortDay(reviewedUpTo.date, now, format)}`, tip: formatDateTime(reviewedUpTo.date) };
}

/** A row's tooltip: the comment's first line, then who, when (in full) and which changeset, which the row says shortly. */
export function changesetRowTip(changeset: Changeset): { text: string; sub: string } {
  return {
    text: commentLineText(changeset.comment) || 'No comment',
    sub: `${displayName(changeset.owner)} · ${formatDateTime(changeset.date)} · cs:${changeset.id}`,
  };
}
