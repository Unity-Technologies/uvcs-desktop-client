import { infiniteQueryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Changeset } from '@shared/domain/changeset';
import { INCOMING_CHANGESETS_PAGE, type BranchIncomingChanges, type IncomingChangesetPage, type IncomingSummary } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { toast } from '../../ui/toast/toastStore';
import { NEWEST_IN_CARD } from './incomingChipState';
import { firstOlderPageParam, listedIncomingChangesets, nextOlderPageParam, showMoreStep } from './olderChangesetPages';

/**
 * The newest incoming changesets the incoming card lists when nothing read them for this head (`cardReadsNewest`): one
 * `cm find … limit` however many came in. Keyed by where the workspace stands and the head, so it is read again only
 * once either moves; refreshes leave it alone (`isIncomingChangesetPage`).
 */
export function useNewestIncomingChangesets(summary: IncomingSummary | undefined, enabled: boolean) {
  const workspacePath = useWorkspacePath();
  const behind = summary?.branch && summary.changesetCount > 0 ? summary : null;
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'newest', behind?.branch, behind?.loadedChangeset, behind?.headChangeset),
    enabled: enabled && behind !== null,
    queryFn: async () => {
      const { branch, loadedChangeset } = behind!;
      return (await api.merge.incomingChangesets(workspacePath, { branch, loadedChangeset, limit: NEWEST_IN_CARD })).changesets;
    },
    staleTime: Infinity,
  });
}

export interface IncomingChangesetList {
  /** The changesets read so far, newest first: the first page `incomingChanges` read, then each one asked for. */
  changesets: Changeset[];
  /** Older ones remain to be read. */
  more: boolean;
  loading: boolean;
  /** Reads the next `INCOMING_CHANGESETS_PAGE` older ones; resolves to whether it read them. */
  showMore: () => Promise<boolean>;
}

/**
 * Incoming's changesets, a page at a time: the newest page comes with the incoming changes, and "Show more" reads the
 * next older one (`changesetid <` the oldest shown), so a workspace 100,000 changesets behind reads 200 to start.
 * Pages read stay until the head moves: refreshes leave them alone (`isIncomingChangesetPage`), and nothing reads them
 * but "Show more" (`showMoreStep`). A page that can't be read says so, once, when it was asked for.
 */
export function useIncomingChangesetList(incoming: BranchIncomingChanges): IncomingChangesetList {
  const workspacePath = useWorkspacePath();
  const older = useInfiniteQuery(olderPagesQuery(workspacePath, incoming));
  const showMore = async (): Promise<boolean> => {
    const before = older.data?.pages.length ?? 0;
    const read = showMoreStep(older.data?.pages) === 'nextPage' ? await older.fetchNextPage() : await older.refetch();
    if (read.error) toast.error("Couldn't read the older changesets", read.error);
    return (read.data?.pages.length ?? 0) > before;
  };
  return { ...listedIncomingChangesets(incoming, older.data?.pages ?? []), loading: older.isFetching, showMore };
}

/**
 * The older pages Incoming read for the incoming changes' head, as the cache holds them, reading nothing: what lets every
 * screen count exactly once they are all read (`knownIncomingSummary`). Undefined while none is.
 */
export function useReadOlderIncomingPages(incoming: BranchIncomingChanges | undefined): readonly IncomingChangesetPage[] | undefined {
  const workspacePath = useWorkspacePath();
  return useInfiniteQuery(olderPagesQuery(workspacePath, incoming)).data?.pages;
}

/** Incoming's older pages for `incoming`'s head: read only when "Show more" asks (`showMore`); what was read shows on every visit. */
function olderPagesQuery(workspacePath: string, incoming: BranchIncomingChanges | undefined) {
  return infiniteQueryOptions({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'older', incoming?.branch, incoming?.loadedChangeset, incoming?.headChangeset),
    enabled: false,
    initialPageParam: incoming ? firstOlderPageParam(incoming) : 0,
    queryFn: ({ pageParam }) =>
      api.merge.incomingChangesets(workspacePath, { branch: incoming!.branch, loadedChangeset: incoming!.loadedChangeset, olderThan: pageParam, limit: INCOMING_CHANGESETS_PAGE }),
    getNextPageParam: nextOlderPageParam,
    staleTime: Infinity,
  });
}
