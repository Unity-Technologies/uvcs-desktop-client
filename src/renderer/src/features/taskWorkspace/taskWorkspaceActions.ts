import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import type { OperationProgress } from '@shared/domain/operation';
import type { TaskWorkspaceActions } from './setUpTaskWorkspace';

/**
 * The `cm` work of a task workspace. The branch is created from the current workspace (same repository) and starts
 * at the head of its parent; the switch reports its progress and stops if `operationId` is cancelled.
 */
export function taskWorkspaceActions(
  currentWorkspacePath: string,
  operationId: string,
  onSwitchProgress: (progress: OperationProgress) => void,
): TaskWorkspaceActions {
  return {
    createBranch: (branch) => api.branches.create(currentWorkspacePath, { name: branch, comment: '' }),
    createWorkspace: async (name, folder, repository) => (await api.workspaces.create({ name, path: folder, repository })).path,
    switchTo: async (workspacePath, branch) => {
      const stopListening = window.uvcs.on('operationProgress', (event) => {
        if (event.operationId === operationId) onSwitchProgress(event.progress);
      });
      try {
        await api.workspaces.switchNewWorkspace(workspacePath, spec.branch(branch), operationId);
      } finally {
        stopListening();
      }
    },
    discardWorkspace: (workspacePath) => api.workspaces.discardNew(workspacePath),
  };
}
