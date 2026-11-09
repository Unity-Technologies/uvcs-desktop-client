import { useMemo } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { navigation } from '../../../app/navigation/navigationStore';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import type { ContextRequest } from './commentContext';
import { openCommentContextDialog } from './CommentContextDialog';
import type { LineThread } from './fileThreads';
import { conversationAt } from './reviewComments';

/**
 * Opens a review's threads in context (`openCommentContextDialog`), from wherever they show: the code, the Comments
 * panel, the conversation. None until the place's repository is known, which the versions are read in.
 */
export function useCommentContext(review: CodeReview, showInConversation?: (threadId: number) => void): ((thread: LineThread, request?: ContextRequest) => void) | undefined {
  const place = usePlace();
  const user = usePlaceUser();
  const repository = usePlaceRepository();
  return useMemo(() => {
    if (repository === undefined) return undefined;
    const showAt = (threadId: number): void => (showInConversation ? showInConversation(threadId) : navigation.openPage(conversationAt(review.id, threadId)));
    return (thread: LineThread, { startsOn, onScreen }: ContextRequest = {}) =>
      openCommentContextDialog({
        place,
        review,
        threadId: thread.root.id,
        user,
        repository: onScreen?.entry.repository ?? repository,
        onScreen: onScreen ?? null,
        startsOn,
        showInConversation: () => showAt(thread.root.id),
      });
  }, [place, review, user, repository, showInConversation]);
}
