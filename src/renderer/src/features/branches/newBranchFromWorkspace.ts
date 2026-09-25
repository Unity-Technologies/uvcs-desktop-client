import type { WorkspaceInfo } from '@shared/domain/workspace';
import { spec } from '@shared/domain/specs';
import { openCreateBranchDialog } from './CreateBranchDialog';

/** Opens the new-branch dialog starting at the changeset the workspace has loaded. */
export function newBranchFromWorkspace(workspace: WorkspaceInfo): void {
  openCreateBranchDialog(workspace.path, {
    parentBranch: workspace.selector.kind === 'branch' ? workspace.selector.name : '/main',
    startingPoint: spec.changeset(workspace.loadedChangeset),
    startingPointLabel: `your workspace's changeset ${workspace.loadedChangeset}`,
  });
}
