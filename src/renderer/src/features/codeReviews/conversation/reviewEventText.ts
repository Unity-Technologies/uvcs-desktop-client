import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import type { BranchRef, ReviewEvent, ReviewEventChange } from '@shared/domain/reviewConversation';
import { displayName, sameUser } from '../../../lib/userName';

/**
 * The icon an event shows: what happened, a review status in its own color, a merge request's move in the glyph and
 * color of the state it moved to.
 */
export type ReviewEventIcon =
  | 'reviewRequested'
  | 'reviewRequestedAgain'
  | 'reviewerRemoved'
  | 'renamed'
  | 'destinationChanged'
  | 'branchHidden'
  | 'branchUnhidden'
  | CodeReviewStatus
  | MergeRequestState;

/** How an event reads in the timeline: its icon, what it says after its author's name, and what its reviewer said. */
export interface ReviewEventRow {
  icon: ReviewEventIcon;
  text: string;
  /** A status change's comment, when it says something. */
  comment?: string;
  /** The changeset a merge request was merged in, named after the text as a chip ("merged this into /main in cs:6"). */
  changeset?: number;
}

/** What an event's text needs from the review it's on: where a merge request merges. */
export interface ReviewEventContext {
  destination?: string;
}

/** A change the timeline shows, and who made it when known: what they did to themselves reads so. */
type ShownChange = Exclude<ReviewEventChange, { kind: 'other' }> & { author?: string };

/** An event the timeline shows; none for one this version doesn't read (`other`), which `timelineOf` leaves out. */
export function reviewEventRow(change: ShownChange, context: ReviewEventContext = {}): ReviewEventRow {
  const text = reviewEventText(change, context);
  switch (change.kind) {
    case 'statusChanged':
      return { icon: change.status, text, ...(change.comment.trim() && { comment: change.comment }) };
    case 'titleChanged':
      return { icon: 'renamed', text };
    case 'mergeRequestState':
      return { icon: change.to, text, ...(change.to === 'Merged' && change.changesetId !== undefined && { changeset: change.changesetId }) };
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
function reviewEventText(change: ShownChange, { destination }: ReviewEventContext): string {
  const isAuthor = (name: string): boolean => change.author !== undefined && sameUser(name, change.author);
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
    case 'mergeRequestState':
      return mergeRequestMoveText(change, destination);
    case 'destinationChanged':
      return destinationChangeText(change.from, change.to);
    case 'branchHidden':
      return 'hid the branch';
    case 'branchUnhidden':
      return 'unhid the branch';
  }
}

/**
 * A merge request's move, by the state it moved to: back to Open says whether it left a draft or was reopened. Merged
 * says into where (the destination now, which a merged request keeps), and in which changeset, the row's chip.
 */
function mergeRequestMoveText({ from, to, changesetId }: Extract<ShownChange, { kind: 'mergeRequestState' }>, destination: string | undefined): string {
  switch (to) {
    case 'Open':
      return from === 'Draft' ? 'marked this as ready for review' : 'reopened this';
    case 'Draft':
      return 'converted this to a draft';
    case 'Closed':
      return 'closed this';
    case 'Merged': {
      const merged = destination ? `merged this into ${destination}` : 'merged this';
      return changesetId !== undefined ? `${merged} in` : merged;
    }
  }
}

/** A branch deleted since has no name to show: the sentence says what it can. */
function destinationChangeText(from: BranchRef, to: BranchRef): string {
  if (from.name !== undefined && to.name !== undefined) return `changed the destination from ${from.name} to ${to.name}`;
  if (to.name !== undefined) return `changed the destination to ${to.name}`;
  return 'changed the destination';
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
