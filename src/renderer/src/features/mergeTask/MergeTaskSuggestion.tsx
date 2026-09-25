import { GitPullRequest } from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { Button } from '../../ui/Button';
import { useBranches } from '../branches/useBranches';
import { openMergeTaskDialog } from './MergeTaskDialog';
import { isTaskBranch } from './mergeTaskSummary';
import { mergeTaskRequest, useMergeTaskPreview } from './useMergeTaskPreview';

/** For a clean workspace on a task branch with something to merge: a quiet way to finish the task. */
export function MergeTaskSuggestion({ workspacePath, branchName }: { workspacePath: string; branchName: string }) {
  const branch = useBranches().data?.find((candidate) => candidate.name === branchName);
  const task = isTaskBranch(branch) ? branch : undefined;
  const { data: plan } = useMergeTaskPreview(workspacePath, mergeTaskRequest(spec.branch(branchName), task?.parent ?? ''), task !== undefined);
  if (!task || plan?.status !== 'ready') return null;

  return (
    <Button variant="ghost" size="small" icon={<GitPullRequest size={13} />} onClick={() => openMergeTaskDialog(workspacePath, task)}>
      Your branch is ready? Merge to {task.parent}
    </Button>
  );
}
