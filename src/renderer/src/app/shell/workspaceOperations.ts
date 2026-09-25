import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { askSwitchWithChanges } from '../../features/branches/SwitchWithChangesDialog';
import { planSwitch } from '../../features/branches/switchOptions';
import { useToastStore } from '../../ui/toast/toastStore';
import { runAction, runOperation } from '../operations/runOperation';
import { switchToast } from './switchToast';

export function updateWorkspace(workspacePath: string): Promise<void | undefined> {
  return runOperation({
    title: 'Updating workspace',
    workspacePath,
    run: (operationId) => api.workspaces.update(workspacePath, operationId),
    successMessage: () => 'Workspace is up to date',
  });
}

/**
 * Switches the workspace to a branch, changeset, label or shelve spec: every switch in the app goes through here.
 * With pending changes it asks (or follows the setting) whether to leave them behind or bring them along;
 * `pendingChanges` skips the question when the caller already asked. Resolves to whether the workspace switched.
 */
export async function switchWorkspace(
  workspacePath: string,
  targetSpec: string,
  displayName: string,
  pendingChanges?: PendingChangesAction,
): Promise<boolean> {
  const action = pendingChanges ?? (await choosePendingChangesAction(workspacePath, targetSpec, displayName));
  if (action === null) return false;

  const result = await runOperation({
    title: `Switching to ${displayName}`,
    workspacePath,
    run: (operationId) => api.workspaces.switchTo(workspacePath, targetSpec, operationId, action),
    // Once changes are shelved, stopping halfway would leave them in limbo.
    cancellable: !action,
  });
  if (!result) return false;

  useToastStore.getState().show(switchToast(result, displayName));
  return true;
}

/** Undefined: nothing to decide. Null: the user cancelled, or the switch isn't possible. */
async function choosePendingChangesAction(workspacePath: string, targetSpec: string, displayName: string): Promise<PendingChangesAction | undefined | null> {
  const preflight = await runAction(workspacePath, `Couldn't switch to ${displayName}`, () => api.workspaces.switchPreflight(workspacePath, targetSpec));
  if (!preflight) return null;

  const { pendingChangesOnSwitch } = await api.settings.get();
  const plan = planSwitch(preflight, pendingChangesOnSwitch, 'leave');
  switch (plan.kind) {
    case 'plain':
      return undefined;
    case 'automatic':
      return plan.action;
    case 'ask':
    case 'blockedByMerge':
      return (
        (await askSwitchWithChanges({ targetName: displayName, preflight, choice: plan.choice, inMerge: plan.kind === 'blockedByMerge' })) ?? null
      );
  }
}
