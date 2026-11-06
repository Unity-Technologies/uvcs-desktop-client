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

/** An event the timeline shows; none for one this version doesn't read (`other`), which `timelineOf` leaves out. */
export function reviewEventRow(change: Exclude<ReviewEventChange, { kind: 'other' }>): ReviewEventRow {
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

/** What an event says after its author's name: "requested a review from Ana and QA Team". */
function reviewEventText(change: Exclude<ReviewEventChange, { kind: 'other' }>): string {
  switch (change.kind) {
    case 'reviewRequested':
      return change.reviewers.length === 0 ? 'requested a review' : `requested a review from ${listed(change.reviewers.map(displayName))}`;
    case 'reviewRequestedAgain':
      return change.reviewer ? `asked ${displayName(change.reviewer)} to review it again` : 'asked for a review again';
    case 'reviewerRemoved':
      return `removed ${displayName(change.reviewer)} from the reviewers`;
    case 'statusChanged':
      return STATUS_WORDS[change.status];
    case 'titleChanged':
      return `renamed it from “${change.from}” to “${change.to}”`;
  }
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
