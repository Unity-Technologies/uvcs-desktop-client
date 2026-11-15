import type { CodeReview } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { usePlace } from '../../../app/workspace/useWorkspace';
import type { MenuEntry } from '../../../lib/actions';
import { reviewCommentCopyTexts } from './commentLink';
import { commentMenu } from './commentMenu';
import { deleteReviewComment, markChangeRequest } from './reviewCommentOperations';
import type { ReviewThread } from './reviewThreads';

/** What its thread offers from the code, in a first comment's menu (`commentMenu`). */
export type CommentThreadActions = Pick<Parameters<typeof commentMenu>[3], 'showInConversation'>;

interface CommentMenuOptions {
  /** The review it's on: its link extends the review's; its change requests are marked applied in its changesets. */
  review: Pick<CodeReview, 'id' | 'target'>;
  comment: ReviewComment;
  thread: ReviewThread;
  user: string | undefined;
  /** Starts editing it where it's shown: in place, or, from a folded card's header, the card unfolded first. */
  edit: () => void;
  threadActions?: CommentThreadActions;
}

/**
 * A comment's menu wired to its operations, the same wherever it shows: on the comment (`ReviewCommentView`), and on a
 * folded card's header for its first comment (`ThreadHeaderView.commentMenu`).
 */
export function useCommentMenu({ review, comment, thread, user, edit, threadActions }: CommentMenuOptions): MenuEntry[] {
  const place = usePlace();
  return commentMenu(comment, thread, user, {
    edit,
    remove: () => void deleteReviewComment(place, comment),
    copyTexts: reviewCommentCopyTexts(place, review.id, comment),
    markChangeRequest: (mark) => void markChangeRequest(place, review, comment, mark),
    ...threadActions,
  });
}
