import { spec } from '@shared/domain/specs';
import { switchToBranch } from '../branches/branchOperations';
import { openMerge } from '../merge/mergeOperations';

/** Brings the destination into the task branch in the workspace, so the conflicts are resolved there first. */
export async function mergeDestinationIntoTask(workspacePath: string, currentBranch: string | undefined, taskBranch: string, destination: string): Promise<void> {
  if (currentBranch !== taskBranch && !(await switchToBranch(workspacePath, taskBranch))) return;
  openMerge({ kind: 'merge', sourceSpec: spec.branch(destination) });
}

/** Merges the task into the destination in the workspace, where the conflicts can be resolved; checking in finishes it. */
export async function resolveOnDestination(workspacePath: string, currentBranch: string | undefined, sourceSpec: string, destination: string): Promise<void> {
  if (currentBranch !== destination && !(await switchToBranch(workspacePath, destination))) return;
  openMerge({ kind: 'merge', sourceSpec });
}
