import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Place } from '@shared/domain/place';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../../app/queryClient';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { conversationQuery } from '../conversation/useReviewConversation';
import { changeRequestsOf, openChangeRequests, reviewsToRead, type ReviewChangeRequest } from './changeRequests';

/** The reviews of one branch (`CodeReviewFilter.targetBranch`): under the reviews' area, so every write on a review reads them again. */
export function branchReviewsQuery(place: Place, branch: string) {
  return {
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'summaries', { targetBranch: branch }),
    queryFn: () => api.codeReviews.listSummaries(place, { targetBranch: branch }),
    ...SLOW_CHANGING_QUERY,
  };
}

/** A branch's open change requests, and whether they're still being read or couldn't be. */
export interface BranchChangeRequests {
  requests: readonly ReviewChangeRequest[];
  reading: boolean;
  failed: boolean;
}

const NONE: readonly ReviewChangeRequest[] = Object.freeze([]);

/**
 * The open change requests a check-in on `branch` can apply (docs/features/code-reviews.md "Applying change
 * requests"): one `cm find review` of the branch, then the conversation of each of its reviews with something open
 * (`reviewsToRead`: usually one), under the key the review's page reads it by, so either finds the other's read.
 * Read rarely (`SLOW_CHANGING_QUERY`: a focus reads nothing), again on a write on a review, a switch to another branch
 * or a check-in that applies one. None while `branch` is undefined (the workspace isn't on a branch) or not `enabled`.
 */
export function useBranchChangeRequests(branch: string | undefined, enabled = true): BranchChangeRequests {
  const place = usePlace();
  const reads = enabled && branch !== undefined;
  const reviews = useQuery({ ...branchReviewsQuery(place, branch ?? ''), enabled: reads });
  const toRead = reads && reviews.data ? reviewsToRead(reviews.data) : [];
  const conversations = useQueries({
    queries: toRead.map((reviewId) => ({ ...conversationQuery(place, reviewId), ...SLOW_CHANGING_QUERY })),
  });
  const data = conversations.map((conversation) => conversation.data);
  // Built again only as a conversation is read again: the reviews read and when each was.
  const readKey = `${toRead.join()}|${conversations.map((conversation) => conversation.dataUpdatedAt).join()}`;
  const requests = useMemo(
    () => (data.length > 0 && data.every((conversation) => conversation !== undefined) ? openChangeRequests(data.map((conversation, index) => changeRequestsOf(toRead[index]!, conversation!))) : NONE),
    [readKey],
  );
  if (!reads) return { requests: NONE, reading: false, failed: false };
  const reading = reviews.isPending || conversations.some((conversation) => conversation.isPending && !conversation.isError);
  const failed = reviews.isError || conversations.some((conversation) => conversation.isError);
  return { requests, reading, failed };
}
