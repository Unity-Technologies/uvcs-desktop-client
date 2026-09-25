import { api } from '../../api/client';
import { runOperation } from '../operations/runOperation';

export function updateWorkspace(workspacePath: string): Promise<void | undefined> {
  return runOperation({
    title: 'Updating workspace',
    workspacePath,
    run: (operationId) => api.workspaces.update(workspacePath, operationId),
    successMessage: () => 'Workspace is up to date',
  });
}

/** Switches the workspace to a branch, changeset, label or shelve spec. */
export function switchWorkspace(workspacePath: string, targetSpec: string, displayName: string): Promise<void | undefined> {
  return runOperation({
    title: `Switching to ${displayName}`,
    workspacePath,
    run: (operationId) => api.workspaces.switchTo(workspacePath, targetSpec, operationId),
    successMessage: () => `Switched to ${displayName}`,
  });
}
