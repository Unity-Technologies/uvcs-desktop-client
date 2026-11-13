import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Place } from '@shared/domain/place';
import { api } from '../../../api/client';
import { SLOW_CHANGING_QUERY } from '../../../app/queryClient';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { reviewConversationQuery } from '../conversation/useReviewConversation';
import { branchReviewsKey } from '../useCodeReviews';
import { branchChangeRequestsOf, reviewsToRead, type BranchChangeRequests } from './changeRequests';

/** The reviews of one branch (`CodeReviewFilter.targetBranch`): under the reviews' area, so every write on a review reads them again. */
export function branchReviewsQuery(place: Place, branch: string) {
  return {
    queryKey: branchReviewsKey(place, branch),
    queryFn: () => api.codeReviews.listSummaries(place, { targetBranch: branch }),
    ...SLOW_CHANGING_QUERY,
  };
}

const NONE: BranchChangeRequests = { requests: [], reading: false, failed: false };

/**
 * The open change requests a check-in on `branch` can apply (docs/features/code-reviews.md "Applying change
 * requests"): one `cm find review` of the branch, then the conversation of each of its reviews with something open
 * (`reviewsToRead`: usually one), under the key the review's page reads it by, so either finds the other's read.
 * Read rarely (`SLOW_CHANGING_QUERY`: a focus reads nothing), again on a write on a review, a check-in, an update or a
 * switch. None while `branch` is undefined (`changeRequestsBranch`) or not `enabled` (the pending changes not read yet).
 */
export function useBranchChangeRequests(branch: string | undefined, enabled: boolean): BranchChangeRequests {
  const place = usePlace();
  const reads = enabled && branch !== undefined;
  const reviews = useQuery({ ...branchReviewsQuery(place, branch ?? ''), enabled: reads });
  const toRead = reads && reviews.data ? reviewsToRead(reviews.data) : [];
  const conversations = useQueries({
    queries: toRead.map((reviewId) => ({ ...reviewConversationQuery(place, reviewId), ...SLOW_CHANGING_QUERY })),
  });
  // Built again only as something is read again: the reviews read and when each was.
  const readKey = `${reviews.dataUpdatedAt}:${reviews.status}|${toRead.join()}|${conversations.map((conversation) => `${conversation.dataUpdatedAt}:${conversation.status}`).join()}`;
  const result = useMemo(
    () => branchChangeRequestsOf(reviews, conversations.map((conversation, index) => ({ reviewId: toRead[index]!, data: conversation.data, isPending: conversation.isPending, isError: conversation.isError }))),
    [readKey],
  );
  return reads ? result : NONE;
}
