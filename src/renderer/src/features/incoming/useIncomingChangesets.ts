import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { INCOMING_CHANGESETS_PAGE, type BranchIncomingChanges, type IncomingSummary } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

/** How many changesets the incoming card lists before "and N more". */
export const NEWEST_IN_CARD = 5;

/**
 * The newest incoming changesets the incoming card lists, read once it opens: one `cm find … limit` however many came
 * in. Keyed by where the workspace stands and the head, so it is read again only once either moves.
 */
export function useNewestIncomingChangesets(summary: IncomingSummary | undefined, open: boolean) {
  const workspacePath = useWorkspacePath();
  const behind = summary?.branch && summary.changesetCount > 0 ? summary : null;
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'newest', behind?.branch, behind?.loadedChangeset, behind?.headChangeset),
    enabled: open && behind !== null,
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
 */
export function useIncomingChangesetList(incoming: BranchIncomingChanges): IncomingChangesetList {
  const workspacePath = useWorkspacePath();
  const { branch, loadedChangeset, headChangeset, changesets, moreChangesets } = incoming;
  const [requested, setRequested] = useState(false);
  const older = useInfiniteQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'older', branch, loadedChangeset, headChangeset),
    enabled: requested && moreChangesets,
    initialPageParam: changesets.at(-1)?.id ?? headChangeset,
    queryFn: ({ pageParam }) => api.merge.incomingChangesets(workspacePath, { branch, loadedChangeset, olderThan: pageParam, limit: INCOMING_CHANGESETS_PAGE }),
    getNextPageParam: (page) => (page.more ? page.changesets.at(-1)?.id : undefined),
    staleTime: Infinity,
  });
  const pages = older.data?.pages ?? [];
  return {
    changesets: pages.length === 0 ? changesets : [...changesets, ...pages.flatMap((page) => page.changesets)],
    more: pages.length === 0 ? moreChangesets : older.hasNextPage,
    loading: older.isFetching,
    showMore: () => (requested ? void older.fetchNextPage() : setRequested(true)),
  };
}
