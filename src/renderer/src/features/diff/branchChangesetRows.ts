import type { Changeset } from '@shared/domain/changeset';
import type { ChangesetSpan } from '../../app/navigation/pages';
import { formatDateTime, formatShortDay, type DayFormat } from '../../lib/formatDate';
import { displayName } from '../../lib/userName';

/**
 * Where the user left off reviewing the branch, as a branch diff's list of changesets reads it: a code review's
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

/** The changesets new to the user, in the order given; none before they reviewed. */
export function newChangesetsOf(changesets: readonly Changeset[], reviewedUpTo: ReviewedUpTo | undefined): Changeset[] {
  return changesets.filter((changeset) => changesetMark(changeset, reviewedUpTo) === 'new');
}

/**
 * The changesets checked in since the user's review, as one span selected together, one diff: what the review's "See
 * the changes" opens on (`PageOf<'codeReview'>.focusChangesets`) and the list's "Show the 3 new" selects.
 * `changesets` in any order. None before a review, while they're read, or when nothing came since.
 */
export function newChangesetsSpan(changesets: readonly Changeset[] | undefined, reviewedUpTo: ReviewedUpTo | undefined): ChangesetSpan | undefined {
  const newIds = newChangesetsOf(changesets ?? [], reviewedUpTo).map((changeset) => changeset.id);
  return newIds.length > 0 ? { oldest: Math.min(...newIds), newest: Math.max(...newIds) } : undefined;
}

/** The line between the new changesets and the reviewed ones: above which row, its words, its tooltip and its link. */
export interface ReviewedSeparator {
  beforeKey: string;
  label: string;
  tip: string;
  /** "Show the 3 new": the link that selects the new changesets shown together, as one diff. */
  showNew: { label: string; span: ChangesetSpan };
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
  const newCount = newChangesetsOf(shown, reviewedUpTo).length;
  const span = newChangesetsSpan(shown, reviewedUpTo)!;
  return {
    beforeKey: String(first.id),
    label: `Reviewed by ${reviewedUpTo.by === undefined ? 'you' : displayName(reviewedUpTo.by)} · ${formatShortDay(reviewedUpTo.date, now, format)}`,
    tip: formatDateTime(reviewedUpTo.date),
    showNew: { label: newCount === 1 ? 'Show the new one' : `Show the ${newCount} new`, span },
  };
}
