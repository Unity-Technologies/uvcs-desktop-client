import type { ReviewEvent, ReviewEventChange } from '@shared/domain/reviewConversation';
import { displayName } from '../../../lib/userName';

/** The icon an event shows: what happened, a status in its own color. */
export type ReviewEventIcon = 'reviewRequested' | 'reviewRequestedAgain' | 'reviewerRemoved' | 'renamed' | 'Under review' | 'Reviewed' | 'Rework required';

/** How an event reads in the timeline: its icon, what it says after its author's name, and what its reviewer said. */
export interface ReviewEventRow {
  icon: ReviewEventIcon;
  text: string;
  /** A status change's comment, when it says something. */
  comment?: string;
}

/** A change the timeline shows, and who made it when known: what they did to themselves reads so. */
type ShownChange = Exclude<ReviewEventChange, { kind: 'other' }> & { author?: string };

/** An event the timeline shows; none for one this version doesn't read (`other`), which `timelineOf` leaves out. */
export function reviewEventRow(change: ShownChange): ReviewEventRow {
  const text = reviewEventText(change);
  switch (change.kind) {
    case 'statusChanged':
      return { icon: change.status, text, ...(change.comment.trim() && { comment: change.comment }) };
    case 'titleChanged':
      return { icon: 'renamed', text };
    default:
      return { icon: change.kind, text };
  }
}

/** Whether the timeline shows an event: not one this version doesn't read, whose text is only the server's. */
export function isShownEvent(event: ReviewEvent): event is ReviewEvent & Exclude<ReviewEventChange, { kind: 'other' }> {
  return event.kind !== 'other';
}

/**
 * What an event says after its author's name: "requested a review from Ana and QA Team". What the author did to
 * themselves reads so: "added themselves as a reviewer", "left the reviewers".
 */
function reviewEventText(change: ShownChange): string {
  const isAuthor = (name: string): boolean => change.author !== undefined && name.toLowerCase() === change.author.toLowerCase();
  const named = (name: string): string => (isAuthor(name) ? 'themselves' : displayName(name));
  switch (change.kind) {
    case 'reviewRequested':
      if (change.reviewers.length === 0) return 'requested a review';
      if (change.reviewers.every(isAuthor)) return 'added themselves as a reviewer';
      return `requested a review from ${listed(change.reviewers.map(named))}`;
    case 'reviewRequestedAgain':
      return change.reviewer ? `asked ${named(change.reviewer)} to review it again` : 'asked for a review again';
    case 'reviewerRemoved':
      return isAuthor(change.reviewer) ? 'left the reviewers' : `removed ${displayName(change.reviewer)} from the reviewers`;
    case 'statusChanged':
      return STATUS_WORDS[change.status];
    case 'titleChanged':
      return `renamed it from “${change.from}” to “${change.to}”`;
  }
}

/** What a folded run of reviewer changes says: "Ana and Bob changed the reviewers 5 times". */
export function reviewerChangesText(events: readonly Pick<ReviewEvent, 'author'>[]): string {
  const authors = [...new Map(events.map((event) => [event.author.toLowerCase(), displayName(event.author)])).values()];
  return `${listed(authors)} changed the reviewers ${events.length} times`;
}

const STATUS_WORDS = {
  'Under review': 'marked it Under review',
  Reviewed: 'marked it Reviewed',
  'Rework required': 'asked for rework',
} as const;

function listed(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
