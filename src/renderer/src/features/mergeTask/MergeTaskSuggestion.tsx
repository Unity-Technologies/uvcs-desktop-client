import { useQuery } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { Button } from '../../ui/Button';
import { useBranch } from '../branches/useBranches';
import { openMergeTaskDialog } from './MergeTaskDialog';
import { isTaskBranch } from './mergeTaskSummary';

/**
 * For a clean workspace on a task branch with changesets of its own: a quiet way to finish the task. It stays cheap:
 * one `cm find` reads the branch (never the list of every branch), and one `cm find` (limit 1) per branch head tells whether
 * the branch has changesets. The merge itself is only previewed once the dialog opens.
 */
export function MergeTaskSuggestion({ workspacePath, branchName }: { workspacePath: string; branchName: string }) {
  const branch = useBranch(branchName).data ?? undefined;
  const task = isTaskBranch(branch) ? branch : undefined;
  const { data: hasChangesets } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergeTaskHasChangesets', branchName, task?.headChangeset),
    queryFn: async () => (await api.changesets.list(workspacePath, { branch: branchName, limit: 1 })).length > 0,
    enabled: task !== undefined,
    // Keyed by the branch head: the answer only changes when the head moves, so refreshes skip it.
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  });
  if (!task || !hasChangesets) return null;

  return (
    <Button variant="ghost" size="small" icon={<GitPullRequest size={13} />} onClick={() => openMergeTaskDialog(workspacePath, task)}>
      Your branch is ready? Merge to {task.parent}
    </Button>
  );
}
