import type { Place } from '@shared/domain/place';
import type { ReviewComment, ReviewConversation } from '@shared/domain/reviewConversation';
import { linkCopyText } from '../../../app/links/linkTo';
import type { PageOf } from '../../../app/navigation/pages';
import type { CopyTexts } from '../../../components/copyMenu';
import { isLineThread } from '../inline/fileThreads';
import { threadsOf } from './reviewThreads';
import { commentLocationPage } from './threadBadges';

/** Where a link to a review's comment opens the review, and whether the review still has that comment. */
export interface CommentLinkOpening {
  page: PageOf<'codeReview'>;
  found: boolean;
}

/**
 * Where a link to a comment (`…/code-reviews/41/-/comments/7`) opens the review, from its conversation as read
 * (docs/features/code-reviews.md "Links to comments"): a thread on a line in Changes, at the thread, in the mode it was
 * written in, as its file's link in the conversation goes (`commentLocationPage`), a reply there too, its thread shown
 * whole; a thread on the whole review in the conversation, at the thread, at the reply for one; the description on the
 * conversation, at its top. A comment the review no longer has opens the review on its conversation.
 */
export function commentLinkPage(reviewId: number, commentId: number, conversation: ReviewConversation): CommentLinkOpening {
  const review: PageOf<'codeReview'> = { kind: 'codeReview', reviewId };
  if (conversation.description?.id === commentId) return { page: review, found: true };
  const thread = threadsOf(conversation.comments).find(({ root, replies }) => root.id === commentId || replies.some((reply) => reply.id === commentId));
  if (!thread) return { page: review, found: false };
  if (isLineThread(thread)) return { page: commentLocationPage(reviewId, thread.root), found: true };
  const reply = thread.root.id === commentId ? {} : { focusReply: commentId };
  return { page: { ...review, tab: 'conversation', focusThread: thread.root.id, ...reply }, found: true };
}

/** What a review's comment is copied as (its menu's Copy): its text, then its link. */
export function reviewCommentCopyTexts(place: Place, reviewId: number, comment: Pick<ReviewComment, 'id' | 'text'>): CopyTexts {
  return { comment: comment.text, link: linkCopyText(place, undefined, { object: { kind: 'codeReview', id: reviewId }, page: { kind: 'reviewComment', commentId: comment.id } }) };
}
