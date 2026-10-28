import { useQuery } from '@tanstack/react-query';
import { repositoryPlace, workspacePathOf, type Place } from '@shared/domain/place';
import { useRecentBranchGuids } from '../../features/branches/recentBranches';
import { recentChangesetsQuery } from '../../features/changesets/recentChangesets';
import { reviewSummariesQuery } from '../../features/codeReviews/useCodeReviews';
import { useWorkspacePaths } from '../../features/files/useWorkspacePaths';
import { usePendingChangesOf } from '../../features/pendingChanges/usePendingChanges';
import { SLOW_CHANGING_QUERY } from '../queryClient';
import { useWorkspaceInfoOf } from '../workspace/useWorkspace';
import { everyBranchQuery, everyLabelQuery, recentShelvesQuery } from './paletteQueryKeys';

/**
 * A placeholder place, never queried: the palette's hooks key their queries by it on the home screen, where no place
 * is shown and every query is off (`enabled` false).
 */
export const NOWHERE: Place = repositoryPlace('');

/** Keeps the lists between palette openings, so reopening it never starts from scratch. */
const CACHE_TIME = 30 * 60_000;

/**
 * The lists the palette answers every keystroke from, fetched once and refreshed in the background: a workspace's
 * files and pending changes, every branch and label, the latest changesets, the recent shelves and code reviews. None
 * on the home screen (no place); a repository explored without a workspace has no files or pending changes.
 */
export function usePaletteLists(shown: Place | null) {
  const enabled = shown !== null;
  const place = shown ?? NOWHERE;
  const workspacePath = workspacePathOf(place);
  const inWorkspace = workspacePath !== null;
  const path = workspacePath ?? '';
  const cached = { enabled, ...SLOW_CHANGING_QUERY, gcTime: CACHE_TIME };

  return {
    files: useWorkspacePaths(path, inWorkspace),
    pendingChanges: usePendingChangesOf(workspacePath),
    workspace: useWorkspaceInfoOf(workspacePath),
    recentBranchGuids: useRecentBranchGuids(path, inWorkspace),
    branches: useQuery({ ...everyBranchQuery(place), ...cached }),
    labels: useQuery({ ...everyLabelQuery(place), ...cached }),
    // Older changesets are still reachable by number (`1234` or `cs:1234`) or by searching them all on demand.
    changesets: useQuery({ ...cached, ...recentChangesetsQuery(place) }),
    shelves: useQuery({ ...recentShelvesQuery(place), ...cached }),
    // The same newest reviews the branch chips read (`useReviewsByBranch`): one query for both.
    codeReviews: useQuery({ ...reviewSummariesQuery(place), ...cached }),
  };
}
