import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { INCOMING_CHANGESETS_PAGE, type BranchIncomingChanges, type IncomingSummary } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { toast } from '../../ui/toast/toastStore';
import { NEWEST_IN_CARD } from './incomingChipState';
import { firstOlderPageParam, listedIncomingChangesets, nextOlderPageParam } from './olderChangesetPages';

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
  /** Reads the next `INCOMING_CHANGESETS_PAGE` older ones. */
  showMore: () => void;
}

/**
 * Incoming's changesets, a page at a time: the newest page comes with the incoming changes, and "Show more" reads the
 * next older one (`changesetid <` the oldest shown), so a workspace 100,000 changesets behind reads 200 to start.
 * Pages read stay until the head moves: refreshes leave them alone (`isIncomingChangesetPage`). A page that can't be
 * read says so.
 */
export function useIncomingChangesetList(incoming: BranchIncomingChanges): IncomingChangesetList {
  const workspacePath = useWorkspacePath();
  const { branch, loadedChangeset, headChangeset, moreChangesets } = incoming;
  const [requested, setRequested] = useState(false);
  const older = useInfiniteQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'older', branch, loadedChangeset, headChangeset),
    enabled: requested && moreChangesets,
    initialPageParam: firstOlderPageParam(incoming),
    queryFn: ({ pageParam }) => api.merge.incomingChangesets(workspacePath, { branch, loadedChangeset, olderThan: pageParam, limit: INCOMING_CHANGESETS_PAGE }),
    getNextPageParam: nextOlderPageParam,
    staleTime: Infinity,
    retry: false,
  });
  useEffect(() => {
    if (older.error) toast.error("Couldn't read the older changesets", older.error);
  }, [older.error]);
  const showMore = (): void => {
    if (!requested) setRequested(true);
    // The first older page failed: there is no page to go on from, so it is read again.
    else if (!older.data) void older.refetch();
    else void older.fetchNextPage();
  };
  return { ...listedIncomingChangesets(incoming, older.data?.pages ?? []), loading: older.isFetching, showMore };
}
