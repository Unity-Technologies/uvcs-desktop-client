import type { ReviewComment } from '@shared/domain/reviewConversation';
import { hasReplies, type ReviewThread } from './reviewThreads';

// What a user may do to a comment, as the official client allows it. The server checks only the permission on what
// the review targets, so these rules are the clients' own.

/** Only its author edits a comment. */
export function canEditComment(comment: ReviewComment, user: string | undefined): boolean {
  return isAuthor(comment, user);
}

/**
 * Only its author deletes a comment, and only while nobody replied to it: `cm` deletes a comment alone, and its
 * replies would be left answering nothing.
 */
export function canDeleteComment(comment: ReviewComment, thread: ReviewThread, user: string | undefined): boolean {
  return isAuthor(comment, user) && !hasReplies(comment, thread);
}

/** A change request still open can be discarded, saying why, by anyone but who asked for it. */
export function canDiscard(thread: ReviewThread, user: string | undefined): boolean {
  return thread.state.kind === 'open' && thread.root.kind === 'changeRequest' && user !== undefined && !isAuthor(thread.root, user);
}

function isAuthor(comment: ReviewComment, user: string | undefined): boolean {
  return user !== undefined && comment.author.toLowerCase() === user.toLowerCase();
}
