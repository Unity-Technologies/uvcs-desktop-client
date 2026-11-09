import { createContext } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { PageOf } from '../../../app/navigation/pages';
import type { DiffFocusRequest } from '../../diff/diffFocusRequest';
import type { ReviewThread } from '../conversation/reviewThreads';
import { anchorPath, writtenIn, type LineThread } from './fileThreads';
import type { ContextRequest } from './useCommentContext';

/** A thread gone to in the Changes tab, again each time (`seq`): the file's diff scrolls to it and marks it. */
export interface ThreadFocus {
  threadId: number;
  seq: number;
}

/**
 * A review's comments, for its Changes tab (`CodeReviewPage`): the file diffs place them (`ReviewFileAnnotator`) and
 * the Comments panel lists them.
 */
export interface ReviewComments {
  review: CodeReview;
  /** None while the conversation is read. */
  threads: readonly ReviewThread[] | undefined;
  user: string | undefined;
  focus: ThreadFocus | null;
  /** Shows a thread in the Changes tab: its file, in the mode it was written in, scrolled to it. */
  goToThread: (thread: LineThread) => void;
  /** Shows a thread in the Conversation tab, among the rest. */
  showInConversation: (threadId: number) => void;
  /** Shows a thread in context (`useCommentContext`); none until the place's repository is known. */
  seeInContext?: (thread: LineThread, request?: ContextRequest) => void;
}

export const ReviewCommentsContext = createContext<ReviewComments | null>(null);

/** The review's conversation, scrolled to a thread and lighting it (Show in conversation, from the code). */
export function conversationAt(reviewId: number, threadId: number): PageOf<'codeReview'> {
  return { kind: 'codeReview', reviewId, tab: 'conversation', focusThread: threadId };
}

/**
 * What the review's diff is asked for to go to a thread: its file (without the leading slash, as the diff names
 * files), in the mode it was written in: the changeset of a comment written changeset by changeset, or the whole
 * branch (`null`); a review of anything but a branch has one mode.
 */
export function threadDiffRequest(review: Pick<CodeReview, 'target'>, thread: LineThread, seq: number): DiffFocusRequest {
  const path = anchorPath(thread.root.anchor);
  if (review.target.kind !== 'branch') return { path, seq };
  const written = writtenIn(review.target, thread);
  return { path, changesetId: written.kind === 'changeset' ? written.changesetId : null, seq };
}
