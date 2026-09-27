import type { IncomingChanges, IncomingSummary, UpdateResolutions } from '@shared/domain/incoming';
import { spec } from '@shared/domain/specs';
import { ApiError, api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';
import { pluralize } from '../../lib/text';
import { useToastStore } from '../../ui/toast/toastStore';
import { useSuccessMomentStore } from '../pendingChanges/successMoment';
import { changesetsFrom, updatedMessage } from './updatedMessage';
import { updateStoppedByConflicts } from './updateFailure';

/**
 * Updates to the incoming changesets (known not to collide with local changes), then says what came in and offers
 * to see it. Resolves to whether it updated.
 */
export async function updateToIncoming(workspacePath: string, incoming: IncomingChanges): Promise<boolean> {
  const updated = await runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    run: async (operationId) => {
      await api.workspaces.update(workspacePath, operationId);
      return true;
    },
    successMessage: () => updatedMessage(incoming),
    successAction: () => ({ label: 'View', run: () => viewIncoming(incoming) }),
    onFailure: explainUpdateConflicts,
  });
  if (updated === true) showUpdatedMoment(workspacePath, incoming);
  return updated === true;
}

/** Changes shows what the update brought for a few seconds, as it does after a check-in. */
export function showUpdatedMoment(workspacePath: string, { branch, loadedChangeset, headChangeset, changesetCount, authors }: IncomingSummary): void {
  if (!branch || changesetCount === 0) return;
  useSuccessMomentStore.getState().show(workspacePath, {
    verb: 'Updated to',
    changesetId: headChangeset,
    branch,
    fromChangeset: loadedChangeset,
    detail: changesetsFrom(changesetCount, authors),
  });
}

/**
 * Shelves the locally changed files the branch deleted or moved, which block the update, then updates, writing the
 * user's merge of the files changed on both sides (`resolutions`; null while some wait: it stops before updating).
 * Changes offers the shelve back afterwards. Resolves to whether it shelved them.
 */
export async function shelveBlockedAndUpdate(workspacePath: string, incoming: IncomingChanges, resolutions: UpdateResolutions | null): Promise<boolean> {
  const result = await runOperation({
    title: 'Shelving the blocking files and updating',
    workspacePath,
    kind: 'update',
    cancellable: false,
    run: (operationId) => api.merge.shelveBlockedAndUpdate(workspacePath, resolutions, operationId),
    successMessage: ({ shelveId, count, updated }) =>
      updated
        ? `${updatedMessage(incoming)} · ${pluralize(count, 'change')} shelved in shelve ${shelveId}`
        : `${pluralize(count, 'change')} shelved in shelve ${shelveId} · merge the remaining files to update`,
    successAction: ({ updated }) => (updated ? { label: 'Restore in Changes', run: () => navigation.goToView('changes') } : undefined),
    onFailure: explainUpdateConflicts,
  });
  if (result?.updated) showUpdatedMoment(workspacePath, incoming);
  return result !== undefined;
}

/** An update that stopped at local changes colliding with incoming ones leads to Incoming rather than to an error. */
export function explainUpdateConflicts(error: unknown): boolean {
  if (!(error instanceof ApiError) || !updateStoppedByConflicts(error.command)) return false;
  useToastStore.getState().show({
    kind: 'error',
    title: 'Update needs your decision',
    detail: 'Some files you changed were also changed, moved or deleted on the branch.',
    action: { label: 'Open Incoming', run: () => navigation.goToView('incoming') },
  });
  return true;
}

function viewIncoming({ loadedChangeset, headChangeset, changesets }: IncomingChanges): void {
  const target =
    changesets.length === 1
      ? ({ kind: 'changeset', changesetId: headChangeset } as const)
      : ({ kind: 'range', fromSpec: spec.changeset(loadedChangeset), toSpec: spec.changeset(headChangeset) } as const);
  const title = changesets.length === 1 ? `Changeset ${headChangeset}` : `Changesets ${loadedChangeset + 1} to ${headChangeset}`;
  navigation.openPage({ kind: 'diff', title, target });
}

/**
 * Updates the workspace, writing the user's merge of every file that changed both locally and on the branch, then
 * says what came in, with the local versions saved before at hand. Resolves to whether it updated.
 */
export async function updateResolvingConflicts(workspacePath: string, incoming: IncomingChanges, resolutions: UpdateResolutions): Promise<boolean> {
  const result = await runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    run: (operationId) => api.merge.updateResolvingConflicts(workspacePath, resolutions, operationId),
    successMessage: () => updatedMessage(incoming),
    successAction: ({ backupDirectory }) =>
      backupDirectory ? { label: 'Show backups', run: () => void api.system.revealInFileManager(backupDirectory) } : undefined,
    onFailure: explainUpdateConflicts,
  });
  if (result) showUpdatedMoment(workspacePath, incoming);
  return result !== undefined;
}
