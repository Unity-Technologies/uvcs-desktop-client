import type { ReviewComment, ReviewEvent } from '@shared/domain/reviewConversation';
import type { ReviewThread } from './reviewThreads';
import { sameUser } from '../../../lib/userName';

// What a user may do to a comment, as the official client allows it. The server checks only the permission on what
// the review targets, so these rules are the clients' own.

/** Only its author edits a comment. */
export function canEditComment(comment: ReviewComment, user: string | undefined): boolean {
  return isAuthor(comment, user);
}

/**
 * Only the reviewer who gave a status edits what they said with it, said or not yet, as the official client allows. Nobody
 * deletes it: the status would go with it.
 */
export function canEditStatusComment(event: ReviewEvent, user: string | undefined): boolean {
  return event.kind === 'statusChanged' && isAuthor(event, user);
}

/** Only its author deletes a comment; the replies under it, anyone's, go with it (`commentsDeletedWith`). */
export function canDeleteComment(comment: ReviewComment, user: string | undefined): boolean {
  return isAuthor(comment, user);
}

/** A change request still open can be discarded, saying why, by anyone but who asked for it. */
export function canDiscard(thread: ReviewThread, user: string | undefined): boolean {
  return thread.state.kind === 'open' && thread.root.kind === 'changeRequest' && user !== undefined && !isAuthor(thread.root, user);
}

function isAuthor(comment: Pick<ReviewComment, 'author'>, user: string | undefined): boolean {
  return user !== undefined && sameUser(comment.author, user);
}
