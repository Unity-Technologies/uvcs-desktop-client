import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { sinceDateFor } from './model/dateRanges';

export function useBranchExplorerData() {
  const workspacePath = useWorkspacePath();
  const { dateRange, showHiddenBranches } = useBranchExplorerPreferences();
  const query = { sinceDate: sinceDateFor(dateRange), includeHidden: showHiddenBranches };

  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'branchExplorer', query),
    queryFn: () => api.branchExplorer.load(workspacePath, query),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}
