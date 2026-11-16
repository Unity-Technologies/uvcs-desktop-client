import { useQuery } from '@tanstack/react-query';
import { useContext, useState } from 'react';
import type { CodeReview, MergeRequestInfo } from '@shared/domain/codeReview';
import { workspacePathOf } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { ViewShownContext } from '../../lib/viewShown';
import { branchQuery } from '../branches/useBranches';
import { checksConflicts, conflictsCheckOf, readsDestinationHead, runsConflictsCheck, type ConflictsCheck } from './mergeRequestConflicts';
import { useReviewChangesets } from './rounds/useReviewChangesets';

export interface MergeRequestConflicts {
  /** What the card shows; none where the card checks no conflicts (`checksConflicts`). */
  conflicts: ConflictsCheck | undefined;
  /** The card's Check: the user asks for it, on this page. */
  check: () => void;
}

/**
 * An open merge request's conflicts with its destination, calculated on the server when the user asks
 * (`runsConflictsCheck`), never by itself: over a second on a big repository. Keyed by both branches' heads (the
 * source's from the changesets the page reads, the destination's from its branch read once asked) and kept, it runs
 * again once when a check-in moves either, while the page stays asked.
 */
export function useMergeRequestConflicts(review: CodeReview, mergeRequest: MergeRequestInfo): MergeRequestConflicts {
  const place = usePlace();
  const tabShown = useContext(ViewShownContext);
  const [askedFor, setAskedFor] = useState<number>();
  const source = review.target.kind === 'branch' ? review.target.branch : undefined;
  const { changesets } = useReviewChangesets(review);
  const workspacePath = workspacePathOf(place);
  const scope = { state: mergeRequest.state, inWorkspace: workspacePath !== null, sourceHead: changesets?.[0]?.id, tabShown, asked: askedFor === review.id };

  const destination = useQuery({ ...branchQuery(place, mergeRequest.destination), ...SLOW_CHANGING_QUERY, enabled: readsDestinationHead(scope) });
  const destinationHead = destination.data?.headChangeset;
  const counts = useQuery({
    queryKey: queryKeys.inPlace(place, 'mergeConflicts', source, scope.sourceHead, mergeRequest.destination, destinationHead),
    queryFn: () => api.merge.conflictCounts(workspacePath!, source!, mergeRequest.destination),
    enabled: runsConflictsCheck({ ...scope, destinationHead }) && source !== undefined,
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  });

  const failed = counts.isError || destination.isError || (scope.asked && destination.data === null);
  return {
    conflicts: checksConflicts(scope) ? conflictsCheckOf({ asked: scope.asked, counts: counts.data, failed }) : undefined,
    check: () => setAskedFor(review.id),
  };
}
