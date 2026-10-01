import { describeSpec } from '../merge/mergeDescription';
import { distinctBranchNames } from '../../lib/distinctBranchNames';

/**
 * How to resolve a task's conflicts in the workspace instead of on the server: merge the destination into the task
 * first, or merge the task on the destination.
 */
export type ConflictPath = 'intoTask' | 'onDestination';

/** One way, as the merge page's "Resolve in the workspace instead" menu offers it. */
export interface WorkspaceResolution {
  path: ConflictPath;
  /** Names the branches as briefly as tells them apart, so long names never overflow. */
  label: string;
  /** What happens next, saying whether the workspace switches first. */
  description: string;
  /** The same with the branches' full names. */
  tip: string;
}

interface WorkspaceResolutionInput {
  /** What the merge brings: the task branch, or the changeset a moved destination left beside its head. */
  sourceSpec: string;
  taskBranch: string;
  destination: string;
  /** The branch the workspace is on. */
  currentBranch: string | undefined;
}

/**
 * The ways to resolve the task in the workspace. Merging the destination into the task makes sense only while the
 * merge brings the whole task branch, not the changeset that finishes a merge whose destination moved.
 */
export function workspaceResolutions({ sourceSpec, taskBranch, destination, currentBranch }: WorkspaceResolutionInput): WorkspaceResolution[] {
  const [task, parent] = distinctBranchNames(taskBranch, destination);
  const intoTask: WorkspaceResolution = {
    path: 'intoTask',
    label: `Merge ${parent} into ${task} first`,
    description: `${currentBranch === taskBranch ? '' : `Switches to ${task}. `}Resolve, check in, then merge again.`,
    tip: `Merge ${destination} into ${taskBranch} in this workspace`,
  };
  const onDestination: WorkspaceResolution = {
    path: 'onDestination',
    label: `Merge on ${parent} in this workspace`,
    description: `${currentBranch === destination ? '' : `Switches to ${parent}. `}Checking in finishes the task.`,
    tip: `Merge ${describeSpec(sourceSpec)} into ${destination} in this workspace`,
  };
  return sourceSpec === `br:${taskBranch}` ? [intoTask, onDestination] : [onDestination];
}
