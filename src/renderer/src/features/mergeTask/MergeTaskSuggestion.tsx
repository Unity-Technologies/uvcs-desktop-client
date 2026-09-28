import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useBranch } from '../branches/useBranches';
import { distinctBranchNames } from './distinctBranchNames';
import { finishedTaskFor, useFinishedTasksStore } from './finishedTask';
import { FinishedTaskCard } from './FinishedTaskCard';
import { openMergeTaskDialog } from './MergeTaskDialog';
import { isTaskBranch } from './mergeTaskSummary';
import { TaskMergeButton } from './TaskMergeButton';

/**
 * For a clean workspace on a task branch with changesets of its own: a quiet way to finish the task, and once it's
 * merged, what to do next. It stays cheap: one `cm find` reads the branch (never the list of every branch), one (limit 1)
 * per branch head tells whether the branch has changesets, and one merge link (limit 1) per head whether that head is
 * already merged into the parent. The merge itself is only previewed once the dialog opens. It names the branches as
 * briefly as tells them apart ("Merge subtask into child_1"), in full in its tooltip; `quiet` where it sits under a list.
 */
export function MergeTaskSuggestion({ workspacePath, branchName, quiet }: { workspacePath: string; branchName: string; quiet?: boolean }) {
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
  const { data: mergedInto } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergeTaskMergedInto', branchName, task?.headChangeset, task?.parent),
    queryFn: () => api.merge.mergedInto(workspacePath, task!.headChangeset, task!.parent),
    enabled: task !== undefined && hasChangesets === true,
    // Keyed by the branch head too. A merge found stays found; "not merged yet" is asked again after operations and,
    // like other slow lists, every few minutes at most.
    ...SLOW_CHANGING_QUERY,
    staleTime: (query) => (query.state.data == null ? SLOW_CHANGING_QUERY.staleTime : Infinity),
  });
  const merged = useFinishedTasksStore((state) => state.merged[workspacePath]);
  const dismissed = useFinishedTasksStore((state) => state.dismissed);

  const finished = finishedTaskFor({ branch: branchName, parent: task?.parent, merged, mergedInto, dismissed });
  if (finished) return <FinishedTaskCard workspacePath={workspacePath} task={finished} />;
  if (!task || !hasChangesets || mergedInto !== null) return null;

  const [source, destination] = distinctBranchNames(task.name, task.parent);
  return (
    <TaskMergeButton
      source={source}
      destination={destination}
      tooltip={`Finish the task: merge ${task.name} into ${task.parent}`}
      quiet={quiet}
      onClick={() => openMergeTaskDialog(workspacePath, task)}
    />
  );
}
