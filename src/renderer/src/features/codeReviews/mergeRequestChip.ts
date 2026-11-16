import type { CodeReviewStatus, CodeReviewSummary, MergeRequestInfo, MergeRequestState } from '@shared/domain/codeReview';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { branchWorkedOn } from '../../components/workingObject';
import { commentLineText } from '../../lib/comments/commentText';
import { openItemsLine, reviewSectionOf, type OpenItems } from './mergeCard';
import { isActiveMergeRequest } from './mergeRequestState';
import { reviewLine } from './reviewChip';

/** A review that is a merge request. */
export type MergeRequestReview = CodeReviewSummary & { mergeRequest: MergeRequestInfo };

/**
 * What a button of the top bar's hover card does; `MergeRequestChip` runs it. One entry per action: what the card
 * offers more (merging it) is one more kind here and one more entry in `cardActionsOf`.
 */
export type MergeRequestChipAction = { kind: 'open'; label: string; primary: boolean };

/** What the top bar's merge request chip shows (`MergeRequestChip`), and its hover card. */
export interface MergeRequestChip {
  reviewId: number;
  /** The state's glyph in its color, leading. */
  state: MergeRequestState;
  /** "#12"; narrow, the chip drops it and keeps the glyph. */
  number: string;
  /** The review status's glyph after the number, only while Open: a draft isn't up for review, a merged one is done. */
  status?: CodeReviewStatus;
  /** Merged: the workspace is still on finished work, said quietly. */
  muted: boolean;
  /** What a screen reader says it is: "Merge request 12 · Open into /main · Under review: Jump higher". */
  label: string;
  card: MergeRequestChipCard;
}

export interface MergeRequestChipCard {
  /** The title's first line. */
  title: string;
  /** "Open · into /main", "Draft · into /main", "Merged into /main". */
  where: string;
  /** Where the review stands while Open, in the merge card's words (`reviewSectionOf`). */
  review?: { status: CodeReviewStatus; title: string; detail?: string };
  /** Whether the reviewers' stack shows: while it is still to merge. */
  showsReviewers: boolean;
  /** "3 change requests and 1 question open", while Open and once its conversation is read (`cardReadsOpenItems`). */
  openItems?: string;
  actions: MergeRequestChipAction[];
}

/**
 * Whether the top bar reads the reviews of the workspace's branch (`branchReviewsQuery`): only on a branch. A workspace
 * on a changeset, a label or a shelve asks nothing.
 */
export function asksForBranchReviews(selector: WorkspaceSelector | null | undefined): boolean {
  return branchWorkedOn(selector) !== undefined;
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

/** The chip and its card for a merge request; `open`, what its conversation still has open, once read. */
export function mergeRequestChipOf(review: MergeRequestReview, open?: OpenItems): MergeRequestChip {
  const { state } = review.mergeRequest;
  const isOpen = state === 'Open';
  return {
    reviewId: review.id,
    state,
    number: `#${review.id}`,
    ...(isOpen && { status: review.status }),
    muted: state === 'Merged',
    label: `${reviewLine(review)}: ${commentLineText(review.title)}`,
    card: {
      title: commentLineText(review.title),
      where: whereItMerges(review.mergeRequest),
      ...(isOpen && { review: reviewOf(review) }),
      showsReviewers: state !== 'Merged',
      ...(isOpen && open && openLine(open)),
      actions: cardActionsOf(),
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

function whereItMerges({ state, destination }: MergeRequestInfo): string {
  return state === 'Merged' ? `Merged into ${destination}` : `${state} · into ${destination}`;
}

function reviewOf({ reviewers, status }: MergeRequestReview): NonNullable<MergeRequestChipCard['review']> {
  const section = reviewSectionOf(reviewers, status);
  return { status, title: section.title, ...(section.detail && { detail: section.detail }) };
}

function openLine(open: OpenItems): Pick<MergeRequestChipCard, 'openItems'> {
  const line = openItemsLine(open);
  return line ? { openItems: line } : {};
}

function cardActionsOf(): MergeRequestChipAction[] {
  return [{ kind: 'open', label: 'Open', primary: true }];
}
