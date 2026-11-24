import type { QueryClient } from '@tanstack/react-query';
import type { CodeReview, CodeReviewFilter, CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { branchTargetIdsOf, withTargetNamed } from '@shared/domain/reviewTargetNames';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

/**
 * The reviews a list's filter keeps, branch targets by id (`listSummaries`): one `cm find review`. The sidebar's count
 * reads them (`useWaitingForMeBadge`), which needs no branch name, and the Merge requests view names them
 * (`namedReviewListQuery`), so the two share the one read.
 */
export function reviewListSummariesQuery(place: Place, filter: CodeReviewFilter) {
  return {
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'listSummaries', filter),
    queryFn: (): Promise<CodeReviewSummary[]> => api.codeReviews.listSummaries(place, filter),
  };
}

/**
 * The reviews the Merge requests view shows, their targets named: the list's summaries (`reviewListSummariesQuery`),
 * taken as the count left them while fresh (the view's own staleness, thirty seconds) or read again, then the names of
 * their branches (`branchNames`). Only the view asks for the names, which may take reading every branch's.
 */
export function namedReviewListQuery(client: QueryClient, place: Place, filter: CodeReviewFilter) {
  return {
    queryKey: queryKeys.inPlace(place, 'codeReviews', filter),
    queryFn: async (): Promise<CodeReview[]> => {
      // A refresh starts every shown query's read in one synchronous pass (`refetchQueries`, `cancelRefetch: true`),
      // and TanStack Query calls a query function synchronously inside `query.fetch`. Started at once, this list's read
      // of the summaries would come first whenever its query sits ahead of the count's in the cache, and the count's
      // refetch would then cancel and restart it: a second `cm find review`. Waiting for the pass to end lets it join
      // the count's read instead. The two "reads the reviews once on a refresh" tests guard it, in both orders.
      await endOfRefetchPass();
      const summaries = await client.fetchQuery(reviewListSummariesQuery(place, filter));
      const branchIds = branchTargetIdsOf(summaries);
      const names = branchIds.length > 0 ? await api.codeReviews.branchNames(place, branchIds) : {};
      return summaries.map((summary) => withTargetNamed(summary, names));
    },
  };
}

/** Resolves once the queries a refresh reads have all started (`refetchQueries` starts them in one synchronous pass). */
function endOfRefetchPass(): Promise<void> {
  return Promise.resolve();
}
