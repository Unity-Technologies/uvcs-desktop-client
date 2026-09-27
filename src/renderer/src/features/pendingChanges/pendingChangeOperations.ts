import type { FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runOperation, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByShelving } from '../../app/refresh/refreshScopes';
import { TRASH_NAME } from '../../lib/platform';
import { formatCount, pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { existsOnDisk, isControlled, isShelvable } from './changeCategories';
import { askUndoChanges } from './UndoChangesDialog';
import { BACKUP_SHELVE_COMMENT } from './undoPlan';

export function absolutePath(workspacePath: string, relativePath: string): string {
  const separator = workspacePath.includes('\\') ? '\\' : '/';
  return `${workspacePath}${separator}${relativePath.split('/').join(separator)}`;
}

/** Undoes the controlled changes after confirming, shelving them first when the user keeps the backup option. */
export async function undoChanges(workspacePath: string, changes: PendingChange[]): Promise<void> {
  const controlled = changes.filter(isControlled);
  if (controlled.length === 0) return;

  const answer = await askUndoChanges(controlled);
  if (!answer) return;

  const paths = controlled.map((change) => change.path);
  let backupShelveId: number | undefined;
  if (answer.backup) {
    // Backup before undo: if the shelve fails, nothing is undone.
    const backedUp = controlled.filter(isShelvable).map((change) => change.path);
    backupShelveId = await runOperation({
      title: `Backing up ${pluralize(controlled.length, 'change')}`,
      workspacePath,
      run: (operationId) => api.pendingChanges.shelve(workspacePath, backedUp, BACKUP_SHELVE_COMMENT, operationId),
      affects: isAffectedByShelving,
      onFailure: (error) => {
        toast.error("Couldn't shelve a backup, so nothing was undone", error);
        return true;
      },
    });
    if (backupShelveId === undefined) return;
  }

  const undone = await runVoidAction(workspacePath, "Couldn't undo the changes", () => api.pendingChanges.undo(workspacePath, paths));
  if (!undone) return;

  const title = `Undid ${pluralize(controlled.length, 'change')}`;
  if (backupShelveId === undefined) {
    toast.success(title);
    return;
  }
  const shelveId = backupShelveId;
  toast.success(`${title} · backed up in shelve ${shelveId}`, undefined, {
    label: 'View',
    run: () => navigation.openPage({ kind: 'diff', title: `Shelve ${shelveId}`, target: { kind: 'shelve', shelveId } }),
  });
}

/** Opens the file with the app the OS associates with it; deleted items have nothing on disk to open. */
export function openWithDefaultApp(workspacePath: string, change: PendingChange): void {
  if (existsOnDisk(change)) void api.system.openPath(absolutePath(workspacePath, change.path));
}

export async function deletePrivateFiles(workspacePath: string, changes: Pick<PendingChange, 'path'>[]): Promise<void> {
  const confirmed = await confirm({
    title: changes.length === 1 ? `Move ${fileName(changes[0]!.path)} to the ${TRASH_NAME}?` : `Move ${formatCount(changes.length)} files to the ${TRASH_NAME}?`,
    message: `These files are not under version control. You can restore them from the ${TRASH_NAME}.`,
    confirmLabel: `Move to ${TRASH_NAME}`,
    danger: true,
  });
  if (!confirmed) return;

  await runAction(workspacePath, "Couldn't delete the files", () =>
    api.system.moveToTrash(changes.map((change) => absolutePath(workspacePath, change.path))),
  );
}

export function addToSourceControl(workspacePath: string, changes: PendingChange[]): Promise<void | undefined> {
  return runAction(workspacePath, "Couldn't add the files", () => api.pendingChanges.add(workspacePath, changes.map((change) => change.path)));
}

export function checkout(workspacePath: string, changes: PendingChange[]): Promise<void | undefined> {
  return runAction(workspacePath, "Couldn't check out the files", () =>
    api.pendingChanges.checkout(workspacePath, changes.map((change) => change.path)),
  );
}

export async function addFilterRule(workspacePath: string, list: FilterRuleList, pattern: string): Promise<void> {
  const added = await runVoidAction(workspacePath, "Couldn't update the rules", () => api.pendingChanges.addFilterRule(workspacePath, list, pattern));
  if (added) toast.success(`Added “${pattern}” to ${FILTER_LIST_FILES[list]}`);
}

export const FILTER_LIST_FILES: Record<FilterRuleList, string> = {
  ignore: 'ignore.conf',
  cloaked: 'cloaked.conf',
  hidden: 'hidden_changes.conf',
};

export function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

export function extensionOf(path: string): string | null {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : null;
}
