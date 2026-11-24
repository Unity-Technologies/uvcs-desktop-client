import type { MergeRequestInfo, MergeRequestState } from '@shared/domain/codeReview';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { branchWorkedOn } from '../../components/workingObject';
import { commentLineText } from '../../lib/comments/commentText';
import { openItemsLine, type OpenItems } from './mergeCard';
import { listedVerdictOf } from './listedVerdict';
import { mergeOfRequest, type MergeInto } from './mergeInto';
import { VERDICT_WORDS, type MergeVerdict } from './mergeVerdict';
import { mergeRequestTip, type MergeRequestReview } from './mergeRequestState';

/**
 * What a button of the top bar's hover card does; `MergeRequestChip` runs it: once an Open request is reviewed, merge
 * it (`mergeOfRequest`, the rule the card and the menus follow). Opening it is the card's title.
 */
export type TopBarRequestAction = { kind: 'merge'; label: string; primary: boolean; merge: MergeInto };

/** What the top bar's merge request chip shows (`MergeRequestChip`, the component), and its hover card. */
export interface TopBarRequestChip {
  reviewId: number;
  /** The state's glyph in its color, leading. */
  state: MergeRequestState;
  /**
   * The state's name in its pill ("Open"), as every merge request's state shows (`MergeRequestStateBadge`); narrow,
   * the pill drops it and keeps the glyph. Never the request's number: the branch beside it already names the work
   * (merge-requests.md "Its number").
   */
  stateText: string;
  /** Whether it can merge, after its pill, as a branch's chip shows it (`listedVerdictOf`): a check, a cross, or none. */
  verdict?: MergeVerdict;
  /**
   * What a screen reader says it is, as the chip shows it: "Merge request · Open into /main · Ready to merge: Jump
   * higher"; no verdict where the chip shows none ("Merge request · Open into /main: Jump higher" while under review).
   */
  label: string;
  card: TopBarRequestCard;
}

/** Under the request's summary (`MergeRequestSummaryCard`), what only the top bar's card has. */
export interface TopBarRequestCard {
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
 * The chip and its card for a merge request; `open`, what its conversation still has open, once read; `source`, the
 * workspace's branch, which the request merges (the top bar's lists name branches by id).
 */
export function mergeRequestChipOf(review: MergeRequestReview, open?: OpenItems, source?: string): TopBarRequestChip {
  const { state } = review.mergeRequest;
  const isOpen = state === 'Open';
  const verdict = listedVerdictOf(review);
  const shown = ['Merge request', whereItMerges(review.mergeRequest), ...(verdict ? [VERDICT_WORDS[verdict]] : [])];
  return {
    reviewId: review.id,
    state,
    stateText: state,
    ...(verdict && { verdict }),
    label: `${shown.join(' · ')}: ${commentLineText(review.title)}`,
    card: {
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

/** "Open into /main", "Merged into /main" (`mergeRequestTip`'s words). */
function whereItMerges(mergeRequest: MergeRequestInfo): string {
  return mergeRequest.state === 'Merged' ? mergeRequestTip({ mergeRequest }) : `${mergeRequest.state} into ${mergeRequest.destination}`;
}

function openLine(open: OpenItems): Pick<TopBarRequestCard, 'openItems'> {
  const line = openItemsLine(open);
  return line ? { openItems: line } : {};
}

/** Merge once an Open one is reviewed; nothing else, as the card's title opens the request. */
function cardActionsOf(review: MergeRequestReview, source: string | undefined): TopBarRequestAction[] {
  const merge = review.status === 'Reviewed' && source !== undefined ? mergeOfRequest({ ...review, target: { kind: 'branch', branch: source } }) : undefined;
  return merge ? [{ kind: 'merge', label: merge.label, primary: true, merge }] : [];
}
