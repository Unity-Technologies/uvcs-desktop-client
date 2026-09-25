import type { IncomingSummary } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { toast } from '../../ui/toast/toastStore';
import { runOperation } from '../operations/runOperation';
import { queryClient } from '../queryClient';

export function updateWorkspace(workspacePath: string): Promise<void | undefined> {
  return runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    run: (operationId) => api.workspaces.update(workspacePath, operationId),
    successMessage: () => 'Workspace is up to date',
  });
}

/** Updates the workspace, after asking the server whether there is anything new; says so when there isn't. */
export async function updateUnlessUpToDate(workspacePath: string): Promise<void> {
  const summaryKey = queryKeys.inWorkspace(workspacePath, 'incoming', 'summary');
  await queryClient.refetchQueries({ queryKey: summaryKey });
  const summary = queryClient.getQueryData<IncomingSummary>(summaryKey);
  if (summary?.branch && summary.changesetCount === 0) toast.info('Already up to date', `Your workspace has everything on ${summary.branch}.`);
  else await updateWorkspace(workspacePath);
}

/** Switches the workspace to a branch, changeset, label or shelve spec. */
export function switchWorkspace(workspacePath: string, targetSpec: string, displayName: string): Promise<void | undefined> {
  return runOperation({
    title: `Switching to ${displayName}`,
    workspacePath,
    kind: 'switch',
    run: (operationId) => api.workspaces.switchTo(workspacePath, targetSpec, operationId),
    successMessage: () => `Switched to ${displayName}`,
  });
}
