import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { askSwitchWithChanges } from '../../features/branches/SwitchWithChangesDialog';
import { planSwitch } from '../../features/branches/switchOptions';
import { explainUpdateConflicts, showUpdatedMoment } from '../../features/incoming/updateOperations';
import { recheckIncoming } from '../../features/incoming/useIncomingSummary';
import { toast } from '../../ui/toast/toastStore';
import { refuseWhileBusy, runOperation, runRead } from '../operations/runOperation';
import { isAffectedByCheckinOrUpdate } from '../refresh/refreshScopes';
import { switchToast } from './switchToast';

/** Resolves to whether it updated. */
export async function updateWorkspace(workspacePath: string): Promise<boolean> {
  const updated = await runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    affects: isAffectedByCheckinOrUpdate,
    run: async (operationId) => {
      await api.workspaces.update(workspacePath, operationId);
      return true;
    },
    successMessage: () => 'Workspace is up to date',
    onFailure: explainUpdateConflicts,
  });
  return updated === true;
}

/** Updates the workspace, after asking the server whether there is anything new; says so when there isn't. */
export async function updateUnlessUpToDate(workspacePath: string): Promise<void> {
  const summary = await recheckIncoming(workspacePath).catch(() => undefined);
  if (summary?.branch && summary.changesetCount === 0) toast.info('Already up to date', `Your workspace has everything on ${summary.branch}.`);
  else if ((await updateWorkspace(workspacePath)) && summary) showUpdatedMoment(workspacePath, summary);
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
  if (refuseWhileBusy(workspacePath)) return false;
  const action = pendingChanges ?? (await choosePendingChangesAction(workspacePath, targetSpec, displayName));
  if (action === null) return false;

  const result = await runOperation({
    title: `Switching to ${displayName}`,
    workspacePath,
    kind: 'switch',
    run: (operationId) => api.workspaces.switchTo(workspacePath, targetSpec, operationId, action),
    // Once changes are shelved, stopping halfway would leave them in limbo.
    cancellable: !action,
    success: (switched) => switchToast(switched, displayName),
  });
  return Boolean(result);
}

/** Undefined: nothing to decide. Null: the user cancelled, or the switch isn't possible. */
async function choosePendingChangesAction(workspacePath: string, targetSpec: string, displayName: string): Promise<PendingChangesAction | undefined | null> {
  const preflight = await runRead(`Couldn't switch to ${displayName}`, () => api.workspaces.switchPreflight(workspacePath, targetSpec));
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
