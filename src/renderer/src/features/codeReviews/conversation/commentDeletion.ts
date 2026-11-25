import type { ReviewComment } from '@shared/domain/reviewConversation';
import type { ReviewThread } from './reviewThreads';

/**
 * What deleting `comment` deletes: every reply under it, at any depth, then the comment itself. `cm` deletes only the
 * comments it's given, and a reply left behind would answer nothing. Each reply goes before what it answers, so a delete
 * cut short (`cm` reaching the server no more) leaves no reply whose comment is gone. A reply `cm` can't delete while it
 * goes on, or one written since the review was read, shows as a thread of its own (`threadsOf`).
 */
export function commentsDeletedWith(comment: ReviewComment, thread: ReviewThread): ReviewComment[] {
  const deleted: ReviewComment[] = [];
  const visit = (answered: ReviewComment) => {
    for (const reply of thread.replies) if (reply.parentId === answered.id) visit(reply);
    deleted.push(answered);
  };
  visit(comment);
  return deleted;
}

/** What the user is asked before deleting `count` comments: one and the replies under it. */
export function deleteConfirmation(count: number): { title: string; message: string } {
  const replies = count - 1;
  if (replies === 0) return { title: 'Delete this comment?', message: 'Everyone on the review stops seeing it.' };
  const what = replies === 1 ? 'its reply' : `its ${replies} replies`;
  return { title: `Delete this comment and ${what}?`, message: 'Everyone on the review stops seeing them.' };
}

/** What a failed delete of `count` comments says: some of the replies may be gone already. */
export function deleteFailedTitle(count: number): string {
  return count > 1 ? "Couldn't delete the comment and its replies" : "Couldn't delete the comment";
}
