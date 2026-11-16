import type { CodeReviewStatus, CodeReviewSummary, MergeRequestInfo, MergeRequestState } from '@shared/domain/codeReview';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { branchWorkedOn } from '../../components/workingObject';
import { commentLineText } from '../../lib/comments/commentText';
import { openItemsLine, reviewSectionOf, type OpenItems } from './mergeCard';
import { mergeOfRequest, type MergeInto } from './mergeInto';
import { isActiveMergeRequest, mergeRequestTip, type MergeRequestReview } from './mergeRequestState';

/**
 * What a button of the top bar's hover card does; `MergeRequestChip` runs it: open the request, or, once an Open one
 * is reviewed, merge it (`mergeOfRequest`, the rule the card and the menus follow).
 */
export type TopBarRequestAction = { kind: 'open'; label: string; primary: boolean } | { kind: 'merge'; label: string; primary: boolean; merge: MergeInto };

/** What the top bar's merge request chip shows (`MergeRequestChip`, the component), and its hover card. */
export interface TopBarRequestChip {
  reviewId: number;
  /** The state's glyph in its color, leading. */
  state: MergeRequestState;
  /** "#12"; narrow, the chip drops it and keeps the glyph. */
  number: string;
  /** The review status's glyph after the number, only while Open: a draft isn't up for review, a merged one is done. */
  status?: CodeReviewStatus;
  /** Merged: the workspace is still on finished work, said quietly. */
  muted: boolean;
  /**
   * What a screen reader says it is, as the chip shows it: "Merge request 12 · Open into /main · Under review: Jump
   * higher"; no status where the chip shows none ("Merge request 12 · Merged into /main: Jump higher").
   */
  label: string;
  card: TopBarRequestCard;
}

export interface TopBarRequestCard {
  /** The title's first line. */
  title: string;
  /** "Open · into /main", "Draft · into /main", "Merged into /main". */
  where: string;
  /** Where the review stands while Open, in the merge card's words (`reviewSectionOf`). */
  review?: { status: CodeReviewStatus; title: string; detail?: string };
  /** Whether the reviewers' stack shows: while it is still to merge and someone reviews it (the review line says when nobody does). */
  showsReviewers: boolean;
  /** "3 change requests and 1 question open", while Open and once its conversation is read (`cardReadsOpenItems`). */
  openItems?: string;
  actions: TopBarRequestAction[];
}

/**
 * Whether the top bar reads the reviews of the workspace's branch (`branchReviewsQuery`): only on a branch, and only
 * once the first screen is in (`firstScreenRead`: the pending changes read, or their read failed), so the read never
 * competes with the window's first data. A workspace on a changeset, a label or a shelve asks nothing.
 */
export function asksForBranchReviews(selector: WorkspaceSelector | null | undefined, firstScreenRead: boolean): boolean {
  return firstScreenRead && branchWorkedOn(selector) !== undefined;
}

/**
 * The merge request the top bar shows for the workspace's branch, from its reviews listed newest first: the newest
 * still to merge (Open or Draft); else the newest merged one, which tells the user they're on finished work; else none.
 * A closed request or a plain code review shows nothing there.
 */
export function topBarRequestOf(reviewsOfBranch: readonly CodeReviewSummary[]): MergeRequestReview | undefined {
  const requests = reviewsOfBranch.filter((review): review is MergeRequestReview => review.mergeRequest !== undefined);
  return requests.find(isActiveMergeRequest) ?? requests.find((review) => review.mergeRequest.state === 'Merged');
}

/**
 * The chip and its card for a merge request; `open`, what its conversation still has open, once read; `source`, the
 * workspace's branch, which the request merges (the top bar's lists name branches by id).
 */
export function mergeRequestChipOf(review: MergeRequestReview, open?: OpenItems, source?: string): TopBarRequestChip {
  const { state } = review.mergeRequest;
  const isOpen = state === 'Open';
  const shown = [`Merge request ${review.id}`, whereItMerges(review.mergeRequest, ' '), ...(isOpen ? [review.status] : [])];
  return {
    reviewId: review.id,
    state,
    number: `#${review.id}`,
    ...(isOpen && { status: review.status }),
    muted: state === 'Merged',
    label: `${shown.join(' · ')}: ${commentLineText(review.title)}`,
    card: {
      title: commentLineText(review.title),
      where: whereItMerges(review.mergeRequest, ' · '),
      ...(isOpen && { review: reviewOf(review) }),
      showsReviewers: state !== 'Merged' && review.reviewers.length > 0,
      ...(isOpen && open && openLine(open)),
      actions: cardActionsOf(review, source),
    },
  };
}

/**
 * Whether the card reads the request's conversation, for what is still open on it: once it shows, for an Open request
 * the server counts something open on (`openIssueCount`). The read is the page's and the check-in's
 * (`reviewConversationQuery`), so either finds the other's.
 */
export function cardReadsOpenItems(review: MergeRequestReview, cardOpen: boolean): boolean {
  return cardOpen && review.mergeRequest.state === 'Open' && review.openIssueCount > 0;
}

/** "Open into /main" (`between` its parts: " · " on the card), "Merged into /main" (`mergeRequestTip`'s words). */
function whereItMerges(mergeRequest: MergeRequestInfo, between: string): string {
  return mergeRequest.state === 'Merged' ? mergeRequestTip({ mergeRequest }) : `${mergeRequest.state}${between}into ${mergeRequest.destination}`;
}

function reviewOf({ reviewers, status }: MergeRequestReview): NonNullable<TopBarRequestCard['review']> {
  const section = reviewSectionOf(reviewers, status);
  return { status, title: section.title, ...(section.detail && { detail: section.detail }) };
}

function openLine(open: OpenItems): Pick<TopBarRequestCard, 'openItems'> {
  const line = openItemsLine(open);
  return line ? { openItems: line } : {};
}

function cardActionsOf(review: MergeRequestReview, source: string | undefined): TopBarRequestAction[] {
  const merge = review.status === 'Reviewed' && source !== undefined ? mergeOfRequest({ ...review, target: { kind: 'branch', branch: source } }) : undefined;
  if (!merge) return [{ kind: 'open', label: 'Open', primary: true }];
  return [
    { kind: 'merge', label: merge.label, primary: true, merge },
    { kind: 'open', label: 'Open', primary: false },
  ];
}
