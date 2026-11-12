import type { Changeset } from '@shared/domain/changeset';
import { commentLineText } from '../../../lib/comments/commentText';
import type { DayFormat } from '../../../lib/formatDate';
import { pluralize } from '../../../lib/text';
import { displayName, sameUser } from '../../../lib/userName';
import type { CheckinsEntry, ReviewRound } from './reviewRounds';

/**
 * A round's line: its name, bold, then what closed it and what it settled: "Round 1", "Rework required by you · 5
 * requests applied, 2 questions answered".
 */
export function roundText(round: ReviewRound, user: string | undefined): { name: string; detail: string } {
  const who = user !== undefined && sameUser(round.reviewer, user) ? 'you' : displayName(round.reviewer);
  const settled = [
    round.applied > 0 && `${pluralize(round.applied, 'request')} applied`,
    round.discarded > 0 && `${round.discarded} discarded`,
    round.answered > 0 && `${pluralize(round.answered, 'question')} answered`,
    round.open > 0 && `${round.open} open`,
  ].filter((part): part is string => typeof part === 'string');
  return { name: `Round ${round.number}`, detail: [`${round.status} by ${who}`, ...(settled.length > 0 ? [settled.join(', ')] : [])].join(' · ') };
}

/**
 * The line before what's new to a reviewer: "New since last review", saying what's under it, and the day of it in the
 * reader's time zone ("Nov 9"), apart, to read a step quieter; no day when the date can't be read.
 */
export function sinceText(date: string, { locale, timeZone }: DayFormat = {}): { label: string; day?: string } {
  const label = 'New since last review';
  const at = new Date(date);
  if (Number.isNaN(at.getTime())) return { label };
  return { label, day: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone }).format(at) };
}

/** What a batch of check-ins says after its author's name: "checked in 3 changesets". */
export function checkinsText(entry: Pick<CheckinsEntry, 'changesets'>): string {
  return entry.changesets.length === 1 ? 'checked in a changeset' : `checked in ${pluralize(entry.changesets.length, 'changeset')}`;
}

/** How many changesets a batch lists before "N more". */
export const MAX_SHOWN_CHECKINS = 5;

/** The changesets a batch lists: all of a short one; the first ones of a longer one and how many more, until shown all. */
export function shownCheckins(changesets: readonly Changeset[], showsAll: boolean): { shown: readonly Changeset[]; more: number } {
  // "1 more" would take the row the changeset itself takes.
  if (showsAll || changesets.length <= MAX_SHOWN_CHECKINS + 1) return { shown: changesets, more: 0 };
  return { shown: changesets.slice(0, MAX_SHOWN_CHECKINS), more: changesets.length - MAX_SHOWN_CHECKINS };
}

/** A changeset's line in a batch: its comment's first line, or that it has none. */
export function checkinCommentText(changeset: Pick<Changeset, 'comment'>): string {
  return commentLineText(changeset.comment) || 'No comment';
}
