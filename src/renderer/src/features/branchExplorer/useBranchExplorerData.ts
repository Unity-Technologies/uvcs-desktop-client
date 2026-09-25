import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { sinceDateFor } from './model/dateRanges';

export function useBranchExplorerData() {
  const workspacePath = useWorkspacePath();
  const { dateRange, showHiddenBranches } = useBranchExplorerPreferences();
  const query = { sinceDate: sinceDateFor(dateRange), includeHidden: showHiddenBranches };

  // Five queries, the merges among the slowest a server answers; for all history, every changeset and merge of the
  // repository. Kept for five minutes; window focus re-reads a date range only, never all history (Refresh does).
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'branchExplorer', query),
    queryFn: () => api.branchExplorer.load(workspacePath, query),
    placeholderData: (previous) => previous,
    staleTime: SLOW_CHANGING_QUERY.staleTime,
    refetchOnWindowFocus: query.sinceDate !== undefined,
  });
}
