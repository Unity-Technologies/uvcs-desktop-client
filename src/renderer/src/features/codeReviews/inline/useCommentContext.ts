import { useContext, useMemo } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import type { ContextRequest } from './commentContext';
import { openCommentContextDialog } from './CommentContextDialog';
import type { LineThread } from './fileThreads';
import { useReviewCheckpoint } from '../rounds/useReviewCheckpoint';
import { ChipOpenerContext } from '../../../components/comments/chipOpener';

/**
 * Opens a review's threads in context (`openCommentContextDialog`), from wherever they show: the code, the Comments
 * panel, the conversation. None until the place's repository is known, which the versions are read in.
 */
export function useCommentContext(review: CodeReview): ((thread: LineThread, request?: ContextRequest) => void) | undefined {
  const place = usePlace();
  const user = usePlaceUser();
  const repository = usePlaceRepository();
  const { stepGroups } = useReviewCheckpoint(review);
  // The dialog shows outside the page (`openDialog`): it takes the page's way of opening chips along.
  const chipOpener = useContext(ChipOpenerContext);
  return useMemo(() => {
    if (repository === undefined) return undefined;
    return (thread: LineThread, { startsOn, onScreen, steps }: ContextRequest = {}) =>
      openCommentContextDialog({
        place,
        review,
        threadId: thread.root.id,
        user,
        repository: onScreen?.entry.repository ?? repository,
        onScreen: onScreen ?? null,
        startsOn,
        steps: steps ?? stepGroups,
        chipOpener,
      });
  }, [place, review, user, repository, stepGroups, chipOpener]);
}
