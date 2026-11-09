import { useMemo } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import type { ContextRequest } from './commentContext';
import { openCommentContextDialog } from './CommentContextDialog';
import type { LineThread } from './fileThreads';
import { showInConversation } from './reviewComments';

/**
 * Opens a review's threads in context (`openCommentContextDialog`), from wherever they show: the code, the Comments
 * panel, the conversation. None until the place's repository is known, which the versions are read in.
 */
export function useCommentContext(review: CodeReview): ((thread: LineThread, request?: ContextRequest) => void) | undefined {
  const place = usePlace();
  const user = usePlaceUser();
  const repository = usePlaceRepository();
  return useMemo(() => {
    if (repository === undefined) return undefined;
    return (thread: LineThread, { startsOn, onScreen }: ContextRequest = {}) =>
      openCommentContextDialog({
        place,
        review,
        threadId: thread.root.id,
        user,
        repository: onScreen?.entry.repository ?? repository,
        onScreen: onScreen ?? null,
        startsOn,
        showInConversation: () => showInConversation(review.id, thread.root.id),
      });
  }, [place, review, user, repository]);
}
