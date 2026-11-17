import { workspacePlace } from '@shared/domain/place';
import { spec } from '@shared/domain/specs';
import type { WorkspaceKind } from '@shared/domain/workspace';
import { offersMerges } from '../../components/mergesOffered';
import { switchToBranch } from '../branches/branchOperations';
import { openMerge } from '../merge/mergeOperations';

/**
 * Whether a task's merge page offers to resolve its conflicts in the workspace instead: both ways merge into the
 * workspace (`mergeDestinationIntoTask`, `resolveOnDestination`), which a partial one refuses (`offersMerges`).
 */
export function offersResolvingInWorkspace({ conflicting, workspacePath, workspaceKind }: { conflicting: boolean; workspacePath: string; workspaceKind: WorkspaceKind | undefined }): boolean {
  return conflicting && offersMerges({ place: workspacePlace(workspacePath), workspaceKind });
}

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
