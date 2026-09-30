import { useQuery } from '@tanstack/react-query';
import type { MergePlan } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { countChangesetsToMerge } from './mergeTaskSummary';

/** How many of the branch's changesets the merge brings; undefined while counting, or when merging a single changeset. */
export function useChangesetsToMerge(workspacePath: string, branchName: string, sourceSpec: string, plan: MergePlan | undefined): number | undefined {
  const fromBranch = sourceSpec === spec.branch(branchName);
  const { data: changesets } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', { branch: branchName }),
    queryFn: () => api.changesets.list(workspacePath, { branch: branchName }),
    enabled: fromBranch,
    refetchOnWindowFocus: false,
  });
  return fromBranch && changesets && plan ? countChangesetsToMerge(changesets, plan, branchName) : undefined;
}
