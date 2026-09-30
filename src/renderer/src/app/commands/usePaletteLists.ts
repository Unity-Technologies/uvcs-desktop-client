import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { useRecentBranchGuids } from '../../features/branches/recentBranches';
import { reviewSummariesQuery } from '../../features/codeReviews/useCodeReviews';
import { useWorkspacePaths } from '../../features/files/useWorkspacePaths';
import { usePendingChangesOf } from '../../features/pendingChanges/usePendingChanges';
import { sinceDateFor } from '../../lib/sincePresets';
import { SLOW_CHANGING_QUERY } from '../queryClient';
import { useWorkspaceInfoOf } from '../workspace/useWorkspace';
import { branchesKey, changesetsKey, labelsKey, shelvesKey } from './paletteQueryKeys';

/** Older changesets are still reachable by number (`1234` or `cs:1234`) or by searching them all on demand. */
const RECENT_CHANGESETS = 2000;
/** New changesets come by the minute. */
const CHANGESETS_STALE_TIME = 60_000;
/** Keeps the lists between palette openings, so reopening it never starts from scratch. */
const CACHE_TIME = 30 * 60_000;

/**
 * The lists the palette answers every keystroke from, fetched once and refreshed in the background: the workspace's
 * files and pending changes, every branch and label, the latest changesets, the recent shelves and code reviews.
 */
export function usePaletteLists(workspacePath: string | null) {
  const enabled = Boolean(workspacePath);
  const path = workspacePath ?? '';
  const cached = { enabled, ...SLOW_CHANGING_QUERY, gcTime: CACHE_TIME };
  const recentFilter: QueryFilter = { limit: RECENT_CHANGESETS };
  // Shelves by everyone pile up by the thousand; older ones are still found by the server search.
  const recentShelvesFilter: QueryFilter = { sinceDate: sinceDateFor('last3Months') };

  return {
    files: useWorkspacePaths(path, enabled),
    pendingChanges: usePendingChangesOf(workspacePath),
    workspace: useWorkspaceInfoOf(workspacePath),
    recentBranchGuids: useRecentBranchGuids(path, enabled),
    branches: useQuery({ queryKey: branchesKey(path, {}), queryFn: () => api.branches.list(path, {}), ...cached }),
    labels: useQuery({ queryKey: labelsKey(path, {}), queryFn: () => api.labels.list(path, {}), ...cached }),
    changesets: useQuery({
      queryKey: changesetsKey(path, recentFilter),
      queryFn: () => api.changesets.list(path, recentFilter),
      ...cached,
      staleTime: CHANGESETS_STALE_TIME,
    }),
    shelves: useQuery({ queryKey: shelvesKey(path, recentShelvesFilter), queryFn: () => api.shelves.list(path, recentShelvesFilter), ...cached }),
    // The same newest reviews the branch chips read (`useReviewsByBranch`): one query for both.
    codeReviews: useQuery({ ...reviewSummariesQuery(path), ...cached }),
  };
}
