import type { Changeset } from '@shared/domain/changeset';
import { conversationLayoutOf, type ConversationInput, type ConversationLayout } from './reviewRounds';

/** The layout a review's page keeps while it's open (`ConversationLayout`), and the review it was laid out for. */
export interface KeptLayout {
  reviewId: number;
  layout: ConversationLayout;
}

/** What the page has read of a review so far, to lay its conversation out from. */
export interface LayoutReading {
  reviewId: number;
  reviewDate: string;
  /** Who the user is: their own statuses split the rounds. None while it's read. */
  user: string | undefined;
  conversation: ConversationInput['conversation'] | undefined;
  /** Whether the conversation is the one the page's opening read (`answerIsCurrent`), not a cached one it replaces. */
  conversationRead: boolean;
  /** The branch's changesets, newest first; none for a review of a changeset or a shelve. */
  changesets: readonly Changeset[] | undefined;
  /** Whether the changesets are this review's, as the page's opening read them (`answerIsCurrent`). */
  changesetsRead: boolean;
}

/**
 * The layout the page keeps after reading `reading`: the one it took for this review, else a new one once everything
 * that places the conversation is read (who the user is, the conversation and the changesets as the page's opening read
 * them), else none yet, the conversation laid out afresh on each read meanwhile. Laid out from a cached read, a thread
 * settled since would stay where it was before.
 */
export function keptLayoutAfter(kept: KeptLayout | undefined, reading: LayoutReading): KeptLayout | undefined {
  if (kept?.reviewId === reading.reviewId) return kept;
  const { conversation, user, changesets, reviewDate } = reading;
  if (!conversation || user === undefined || !reading.conversationRead || !reading.changesetsRead) return undefined;
  return { reviewId: reading.reviewId, layout: conversationLayoutOf({ conversation, user, changesets, reviewDate }) };
}

/** What a query says of its answer (TanStack Query's result). */
export interface QueryAnswer {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
}

/**
 * Whether a query's answer is the one to lay out from: read (or failed) and not being read again. A cached answer is
 * read again as the page opens once stale, which shows from its first render (`isFetching`), and a previous review's
 * changesets stay on screen while this one's are read (`isPlaceholderData`).
 */
export function answerIsCurrent({ data, isError, isFetching, isPlaceholderData }: QueryAnswer): boolean {
  return (data !== undefined || isError) && !isFetching && !isPlaceholderData;
}
