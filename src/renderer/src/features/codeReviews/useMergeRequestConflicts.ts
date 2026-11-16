import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useState } from 'react';
import type { CodeReview, MergeRequestInfo } from '@shared/domain/codeReview';
import { workspacePathOf } from '@shared/domain/place';
import { api } from '../../api/client';
import { IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { ViewShownContext } from '../../lib/viewShown';
import { branchQuery } from '../branches/useBranches';
import { mergeConflictsKey } from './mergeConflictsKey';
import { checksConflicts, conflictsCheckOf, conflictsCheckRequest, readsDestinationHead, type ConflictsCheck } from './mergeRequestConflicts';
import { useReviewChangesets } from './rounds/useReviewChangesets';

export interface MergeRequestConflicts {
  /** What the card shows; none where the card checks no conflicts (`checksConflicts`). */
  conflicts: ConflictsCheck | undefined;
  /** The card's Check: the user asks for it, on this page. */
  check: () => void;
}

/** The request the user asked about on this page, and whether the destination's head was read again since. */
interface Asked {
  reviewId: number;
  destinationRead: boolean;
}

/**
 * An open merge request's conflicts with its destination, calculated on the server when the user asks
 * (`conflictsCheckRequest`), never by itself: over a second on a big repository. Check reads the destination's head
 * again, then the merge is keyed by both heads (the source's from the changesets the page reads) and kept: Check
 * answers at once from it when neither moved, and a check-in that moves either checks again, once, while the page
 * stays asked. A check that failed is asked again by the next Check.
 */
export function useMergeRequestConflicts(review: CodeReview, mergeRequest: MergeRequestInfo): MergeRequestConflicts {
  const place = usePlace();
  const queryClient = useQueryClient();
  const tabShown = useContext(ViewShownContext);
  const [asked, setAsked] = useState<Asked>();
  const askedHere = asked?.reviewId === review.id;
  const { changesets } = useReviewChangesets(review);
  const scope = {
    state: mergeRequest.state,
    workspacePath: workspacePathOf(place),
    source: review.target.kind === 'branch' ? review.target.branch : undefined,
    destination: mergeRequest.destination,
    sourceHead: changesets?.[0]?.id,
    tabShown,
    asked: askedHere,
    destinationRead: askedHere && asked.destinationRead,
  };

  const destinationBranch = branchQuery(place, mergeRequest.destination);
  const destination = useQuery({ ...destinationBranch, ...SLOW_CHANGING_QUERY, enabled: readsDestinationHead(scope) });
  const destinationHead = destination.data?.headChangeset;
  const request = conflictsCheckRequest({ ...scope, destinationHead });
  const counts = useQuery({
    queryKey: mergeConflictsKey(place, scope.source, scope.sourceHead, mergeRequest.destination, destinationHead),
    queryFn: request ? () => api.merge.conflictCounts(request.workspacePath, request.source, request.destination) : skipToken,
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  });

  const check = (): void => {
    // A check that failed is kept as failed: asking again runs it again.
    queryClient.removeQueries({ queryKey: mergeConflictsKey(place, scope.source), predicate: (query) => query.state.status === 'error' });
    setAsked({ reviewId: review.id, destinationRead: false });
    const destinationRead = (current: Asked | undefined) => (current?.reviewId === review.id ? { ...current, destinationRead: true } : current);
    // One read of the destination's head, however fresh the kept one looks: it keys the check. A failure stays on its query.
    void queryClient
      .fetchQuery({ ...destinationBranch, staleTime: 0 })
      .catch(() => undefined)
      .finally(() => setAsked(destinationRead));
  };

  return {
    conflicts: checksConflicts(scope)
      ? conflictsCheckOf({
          asked: scope.asked,
          destinationRead: scope.destinationRead,
          counts: counts.data,
          checkFailed: counts.isError,
          destinationFailed: destination.isError,
          destinationMissing: destination.data === null,
        })
      : undefined,
    check,
  };
}
