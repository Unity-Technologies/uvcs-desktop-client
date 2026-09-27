import type { ShelvedAway, Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation, useNavigation } from '../../app/navigation/navigationStore';
import { runOperation, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByShelvingAway } from '../../app/refresh/refreshScopes';
import { pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { toast, type ToastAction } from '../../ui/toast/toastStore';
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

/** Leads to Changes, unless it's what the window shows. */
function viewChangesAction(): ToastAction | undefined {
  const { view, pages } = useNavigation.getState();
  return view === 'changes' && pages.length === 0 ? undefined : { label: 'View changes', run: () => navigation.goToView('changes') };
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
 * Shelves changes (every pending change when `paths` is null) and undoes them: they wait in the shelve, and Undo
 * puts them back at once.
 */
export function shelveAway(workspacePath: string, paths: string[] | null, comment: string): Promise<ShelvedAway | undefined> {
  return runOperation({
    title: paths ? `Shelving ${pluralize(paths.length, 'change')}` : 'Shelving your changes',
    workspacePath,
    run: (operationId) => api.pendingChanges.shelveAndUndo(workspacePath, paths, comment, operationId),
    affects: isAffectedByShelvingAway,
    cancellable: false,
    success: ({ shelveId, count }) => ({
      title: `Shelved ${pluralize(count, 'change')}`,
      detail: `In shelve ${shelveId}`,
      action: { label: 'Undo', run: () => void applyShelve(workspacePath, shelveId, true) },
    }),
  });
}

export function showShelveChanges(shelve: Shelve, focusPath?: string): void {
  navigation.openPage({ kind: 'diff', title: `Shelve ${shelve.id}`, target: { kind: 'shelve', shelveId: shelve.id }, focusPath });
}

export async function deleteShelve(workspacePath: string, shelveId: number): Promise<boolean> {
  const confirmed = await confirm({
    title: `Delete shelve ${shelveId}?`,
    message: 'The shelved changes will be lost. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return false;

  const deleted = await runVoidAction(workspacePath, "Couldn't delete the shelve", () => api.shelves.delete(workspacePath, shelveId));
  if (deleted) toast.success(`Deleted shelve ${shelveId}`);
  return deleted;
}
