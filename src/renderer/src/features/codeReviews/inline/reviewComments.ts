import { createContext } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { navigation } from '../../../app/navigation/navigationStore';
import type { PageOf } from '../../../app/navigation/pages';
import type { DiffFocusRequest } from '../../diff/diffFocusRequest';
import type { ReviewThread } from '../conversation/reviewThreads';
import { anchorPath, writtenIn, type LineThread } from './fileThreads';
import type { ContextRequest } from './commentContext';

/**
 * The thread selected in the Changes tab, again each time (`seq`): its card and line marked, its entry in the Comments
 * panel too. Gone to (from the panel, the keys, the conversation), the file's diff scrolls to it; picked in the code
 * (`inPlace`), it's on screen already and the diff stays where it is.
 */
export interface ThreadFocus {
  threadId: number;
  seq: number;
  inPlace?: boolean;
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
  /** Selects a thread already on screen, its card clicked or focused in the code: nothing scrolls but the panel's list. */
  selectThread: (thread: LineThread) => void;
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
 * Show in conversation, from the code or See in context: the review's page moves to its conversation at the thread, in
 * place, as its tabs move. Never stacked: both tabs stay mounted and keep their state, so Back leaves the review (in a
 * page window, closes it).
 */
export function showInConversation(reviewId: number, threadId: number): void {
  navigation.replacePage(conversationAt(reviewId, threadId));
}

/**
 * What the review's diff is asked for to go to a thread: its file (without the leading slash, as the diff names
 * files), in the mode it was written in: the changeset of a comment written in one changeset's diff, or the whole
 * branch (`null`); a review of anything but a branch has one mode. `inChangeset`, the changeset the page names (a
 * change request shown where it was applied), wins over where it was written.
 */
export function threadDiffRequest(review: Pick<CodeReview, 'target'>, thread: LineThread, seq: number, inChangeset?: number): DiffFocusRequest {
  const path = anchorPath(thread.root.anchor);
  if (review.target.kind !== 'branch') return { path, seq };
  if (inChangeset !== undefined) return { path, changesetId: inChangeset, seq };
  const written = writtenIn(review.target, thread);
  return { path, changesetId: written.kind === 'changeset' ? written.changesetId : null, seq };
}
