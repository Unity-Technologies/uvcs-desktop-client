import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { ReviewConversation } from '@shared/domain/reviewConversation';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { changeRequestsNamedIn } from '@shared/applyChange';
import type { CheckinMode } from '../../pendingChanges/checkinButton';
import type { ChipCard } from '../../../components/comments/chipContent';
import { commentLineText } from '../../../lib/comments/commentText';
import { shortGuid } from '../../../lib/comments/commentReferences';
import { displayName } from '../../../lib/userName';
import { threadsOf, writtenOrder, type ThreadState } from '../conversation/reviewThreads';

/** Where a change request stands, as its thread does (`threadsOf`): open until a changeset applies it or a reply discards it. */
export type ChangeRequestState = Extract<ThreadState, { kind: 'open' | 'applied' | 'discarded' }>;

/**
 * A change request of a code review, as a check-in comment names it to apply it (`[apply-change:c0d1ce00]`,
 * docs/features/code-reviews.md "Applying change requests").
 */
export interface ReviewChangeRequest {
  reviewId: number;
  /** Its comment's id: its thread's, which the review's page goes to (`conversationAt`). */
  commentId: number;
  guid: string;
  author: string;
  date: string;
  text: string;
  /** The file and line it was written on; none for one on the whole review. */
  location?: { path: string; line: number };
  state: ChangeRequestState;
}

const READ = new WeakMap<ReviewConversation, ReviewChangeRequest[]>();

/**
 * Every change request of a review's conversation, with where it stands. Read once per conversation read: the chips
 * and the suggestions ask for it at each render, and a chip's store must get the same objects back.
 */
export function changeRequestsOf(reviewId: number, conversation: ReviewConversation): ReviewChangeRequest[] {
  const known = READ.get(conversation);
  if (known) return known;
  const requests = threadsOf(conversation.comments).flatMap(({ root, state }): ReviewChangeRequest[] => {
    if (root.kind !== 'changeRequest' || state.kind === 'none' || state.kind === 'answered') return [];
    return [
      {
        reviewId,
        commentId: root.id,
        guid: root.guid,
        author: root.author,
        date: root.date,
        text: root.text,
        ...(root.anchor.kind === 'line' && { location: { path: root.anchor.path, line: root.anchor.line } }),
        state,
      },
    ];
  });
  READ.set(conversation, requests);
  return requests;
}

/**
 * The reviews of a branch whose conversations are read for their change requests: every one with something open
 * (`openIssueCount`, the server's count of open requests and questions), the newest first. A branch has one review,
 * rarely two; one with nothing open, or none at all, reads nothing more.
 */
export function reviewsToRead(reviews: readonly CodeReviewSummary[]): number[] {
  return reviews
    .filter((review) => review.openIssueCount > 0)
    .map((review) => review.id)
    .sort((a, b) => b - a);
}

/** The open change requests of the reviews read, the newest first (`writtenOrder`): what a check-in comment can apply. */
export function stillOpen(reviews: readonly (readonly ReviewChangeRequest[])[]): ReviewChangeRequest[] {
  return reviews
    .flat()
    .filter((request) => request.state.kind === 'open')
    .sort((a, b) => writtenOrder({ date: b.date, id: b.commentId }, { date: a.date, id: a.commentId }));
}

/** A read as TanStack Query gives it. */
export interface Read<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
}

/** A branch's open change requests, and whether some are still being read or couldn't be. */
export interface BranchChangeRequests {
  requests: readonly ReviewChangeRequest[];
  reading: boolean;
  failed: boolean;
}

/**
 * What a check-in offers to apply from its branch's reviews (`useBranchChangeRequests`): the open requests of every
 * conversation read, as they come, so one review that couldn't be read hides none of the others'; `reading` while the
 * reviews or any conversation are, `failed` when any couldn't be read.
 */
export function branchChangeRequestsOf(reviews: Read<readonly CodeReviewSummary[]>, conversations: readonly (Read<ReviewConversation> & { reviewId: number })[]): BranchChangeRequests {
  const read = conversations.flatMap((conversation) => (conversation.data ? [changeRequestsOf(conversation.reviewId, conversation.data)] : []));
  return {
    requests: stillOpen(read),
    reading: (reviews.isPending && !reviews.isError) || conversations.some((conversation) => conversation.isPending && !conversation.isError),
    failed: reviews.isError || conversations.some((conversation) => conversation.isError),
  };
}

/**
 * The branch whose change requests a check-in offers to apply: the workspace's, while it is on a branch and the panel
 * checks in. A shelve applies none (`cm shelve` never reads them), and a workspace on a changeset, a label or a shelve
 * checks in to no branch of its own.
 */
export function changeRequestsBranch(workingOn: WorkspaceSelector | undefined, mode: CheckinMode): string | undefined {
  return mode === 'checkin' && workingOn?.kind === 'branch' ? workingOn.name : undefined;
}

/**
 * The requests the comment doesn't name yet (`[apply-change:…]`, as `cm` reads it): one already written isn't offered
 * again, and the button's count follows.
 */
export function notYetNamed(requests: readonly ReviewChangeRequest[], comment: string): readonly ReviewChangeRequest[] {
  const named = changeRequestsNamedIn(comment);
  if (named.length === 0) return requests;
  return requests.filter((request) => !named.includes(shortGuid(request.guid)) && !named.includes(request.guid.toLowerCase()));
}

/** The request a comment names (`[apply-change:c0d1ce00]`, or its whole guid) among those read, as `cm` matches it. */
export function changeRequestNamed(reviews: readonly (readonly ReviewChangeRequest[])[], guid: string): ReviewChangeRequest | undefined {
  const named = guid.toLowerCase();
  const matches = named.length === 8 ? (request: ReviewChangeRequest) => shortGuid(request.guid) === named : (request: ReviewChangeRequest) => request.guid.toLowerCase() === named;
  for (const requests of reviews) {
    const found = requests.find(matches);
    if (found) return found;
  }
  return undefined;
}

/** How a change request named in a comment shows: its chip's words, its card, and the thread a click opens. */
export interface ChangeRequestChip {
  /** What the chip says it does, muted before the request: the comment applies it. */
  lead: string;
  /** The request's first line; its number while the window hasn't read it. */
  label: string;
  /** The chip's name for a screen reader: "Applies change request: Shelve first". */
  name: string;
  /** "Change request c0d1ce00": the card's. */
  title: string;
  card: ChipCard;
  /** The review's thread it opens; none for a request the window hasn't read. */
  opens?: { reviewId: number; threadId: number };
}

const LEAD = 'Applies:';

/**
 * A change request's chip (docs/features/rich-comments.md, "How references show"): "Applies:" muted, then its first line,
 * and a card saying where it stands, its review, who asked and when. One the window hasn't read (`request` undefined)
 * reads "Applies: change request c0d1ce00" and opens nothing: a chip reads nothing of its own.
 */
export function changeRequestChip(request: ReviewChangeRequest | undefined, guid: string, ago: (date: string) => string): ChangeRequestChip {
  const number = shortGuid(guid);
  const title = `Change request ${number}`;
  if (!request) {
    const label = `change request ${number}`;
    return { lead: LEAD, label, name: `Applies ${label}`, title, card: { title, meta: [] } };
  }
  const label = commentLineText(request.text) || title;
  return {
    lead: LEAD,
    label,
    name: `Applies change request: ${label}`,
    title,
    card: { comment: request.text, title, meta: [title, stateText(request.state), `Code review ${request.reviewId}`, displayName(request.author), ago(request.date)] },
    opens: { reviewId: request.reviewId, threadId: request.commentId },
  };
}

function stateText(state: ChangeRequestState): string {
  switch (state.kind) {
    case 'open':
      return 'Open';
    case 'applied':
      return `Applied in changeset ${state.changesetId}`;
    case 'discarded':
      return 'Discarded';
  }
}
