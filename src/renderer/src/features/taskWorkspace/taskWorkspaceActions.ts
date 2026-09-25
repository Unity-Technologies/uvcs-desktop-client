import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { describeProgressLine } from '../../app/operations/describeProgressLine';
import type { TaskWorkspaceActions } from './setUpTaskWorkspace';

/**
 * The `cm` work of a task workspace. The branch is created from the current workspace (same repository) and starts
 * at the head of its parent; the switch reports its progress and stops if `operationId` is cancelled.
 */
export function taskWorkspaceActions(currentWorkspacePath: string, operationId: string, onSwitchProgress: (detail: string) => void): TaskWorkspaceActions {
  return {
    createBranch: (branch) => api.branches.create(currentWorkspacePath, { name: branch, comment: '' }),
    createWorkspace: async (name, folder, repository) => (await api.workspaces.create({ name, path: folder, repository })).path,
    switchTo: async (workspacePath, branch) => {
      const stopListening = window.uvcs.on('operationProgress', (progress) => {
        const detail = progress.operationId === operationId && describeProgressLine(progress.line);
        if (detail) onSwitchProgress(detail);
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
