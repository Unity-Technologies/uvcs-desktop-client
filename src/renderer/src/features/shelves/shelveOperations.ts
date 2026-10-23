import { workspacePlace } from '@shared/domain/place';
import type { ShelveAwayRequest, ShelvedAway, Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { viewChangesAction } from '../../app/navigation/viewChangesAction';
import { runOperation, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByShelveApplied, isAffectedByShelveDeletion, isAffectedByShelvingAway } from '../../app/refresh/refreshScopes';
import { pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { appliedShelveMessage, setAsideComment } from './shelveMessages';

/**
 * Applies a shelve to the workspace as a merge from it, never with `cm shelveset apply` (it would open the external
 * merge tool on conflicts), and deletes it after if asked ("Apply and delete", restoring). Shelves that conflict open
 * the merge view instead. `cm` merges only into a workspace without pending changes: it offers to shelve them first.
 * Resolves to whether the shelve was applied.
 */
export async function applyShelve(workspacePath: string, shelveId: number, deleteShelve: boolean): Promise<boolean> {
  const result = await runOperation({
    title: `Applying shelve ${shelveId}`,
    workspacePath,
    run: (operationId) => api.shelves.apply(workspacePath, shelveId, deleteShelve, operationId),
    affects: isAffectedByShelveApplied,
    cancellable: false,
    success: (outcome) => (outcome.kind === 'applied' ? { title: appliedShelveMessage(shelveId, outcome.count, deleteShelve), action: viewChangesAction() } : null),
  });

  switch (result?.kind) {
    case 'applied':
      return true;
    case 'conflicts':
      navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.shelve(shelveId), ...(deleteShelve && { deleteShelve }) } });
      return false;
    case 'pendingChanges':
      return (await shelvePendingChangesFirst(workspacePath, shelveId)) && applyShelve(workspacePath, shelveId, deleteShelve);
    default:
      return false;
  }
}

async function shelvePendingChangesFirst(workspacePath: string, shelveId: number): Promise<boolean> {
  const confirmed = await confirm({
    title: 'Shelve your changes first?',
    message: 'Shelves apply to a workspace without pending changes. Yours go into a new shelve, to apply whenever you like.',
    confirmLabel: 'Shelve and apply',
  });
  return confirmed && (await shelveAway(workspacePath, null, setAsideComment(shelveId))) !== undefined;
}

/**
 * Shelves changes (every pending change when `request` is null) and undoes them: they wait in the shelve, and Undo
 * puts them back at once.
 */
export function shelveAway(workspacePath: string, request: ShelveAwayRequest | null, comment: string): Promise<ShelvedAway | undefined> {
  return runOperation({
    title: request ? `Shelving ${pluralize(request.paths.length, 'change')}` : 'Shelving your changes',
    workspacePath,
    run: (operationId) => api.pendingChanges.shelveAndUndo(workspacePath, request, comment, operationId),
    affects: isAffectedByShelvingAway,
    cancellable: false,
    success: ({ shelveId, count }) => ({
      title: `Shelved ${pluralize(count, 'change')}`,
      detail: `In shelve ${shelveId}`,
      action: { label: 'Undo', run: () => void applyShelve(workspacePath, shelveId, true) },
    }),
  });
}

/** The diff of what a shelve holds. */
export function shelveDiffPage(shelve: Pick<Shelve, 'id'>, focusPath?: string): PageOf<'diff'> {
  return { kind: 'diff', title: `Shelve ${shelve.id}`, target: { kind: 'shelve', shelveId: shelve.id }, focusPath };
}

export function showShelveChanges(shelve: Pick<Shelve, 'id'>, focusPath?: string): void {
  navigation.openPage(shelveDiffPage(shelve, focusPath));
}

export async function deleteShelve(workspacePath: string, shelveId: number): Promise<boolean> {
  const confirmed = await confirm({
    title: `Delete shelve ${shelveId}?`,
    message: 'The shelved changes will be lost. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return false;

  const deleted = await runVoidAction(workspacePlace(workspacePath), "Couldn't delete the shelve", () => api.shelves.delete(workspacePath, shelveId), isAffectedByShelveDeletion);
  if (deleted) toast.success(`Deleted shelve ${shelveId}`);
  return deleted;
}
