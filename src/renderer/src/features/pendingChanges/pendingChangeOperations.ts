import type { FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { isControlled } from './changeCategories';

export function absolutePath(workspacePath: string, relativePath: string): string {
  const separator = workspacePath.includes('\\') ? '\\' : '/';
  return `${workspacePath}${separator}${relativePath.split('/').join(separator)}`;
}

export async function undoChanges(workspacePath: string, changes: PendingChange[]): Promise<void> {
  const controlled = changes.filter(isControlled);
  if (controlled.length === 0) return;

  const confirmed = await confirm({
    title: controlled.length === 1 ? `Undo changes to ${fileName(controlled[0]!.path)}?` : `Undo ${controlled.length} changes?`,
    message: 'Your local modifications will be lost. This cannot be undone.',
    confirmLabel: 'Undo changes',
    danger: true,
  });
  if (!confirmed) return;

  await runAction(workspacePath, "Couldn't undo the changes", () => api.pendingChanges.undo(workspacePath, controlled.map((change) => change.path)));
}

export async function deletePrivateFiles(workspacePath: string, changes: PendingChange[]): Promise<void> {
  const confirmed = await confirm({
    title: changes.length === 1 ? `Move ${fileName(changes[0]!.path)} to the trash?` : `Move ${changes.length} files to the trash?`,
    message: 'These files are not under version control. You can restore them from the trash.',
    confirmLabel: 'Move to trash',
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
  const added = await runAction(workspacePath, "Couldn't update the rules", () => api.pendingChanges.addFilterRule(workspacePath, list, pattern));
  if (added !== undefined) toast.success(`Added “${pattern}” to ${FILTER_LIST_FILES[list]}`);
}

export const FILTER_LIST_FILES: Record<FilterRuleList, string> = {
  ignore: 'ignore.conf',
  cloaked: 'cloaked.conf',
  hidden: 'hidden_changes.conf',
};

export function copyPaths(paths: string[]): void {
  void navigator.clipboard.writeText(paths.join('\n'));
  toast.info(paths.length === 1 ? 'Path copied' : `${paths.length} paths copied`);
}

export function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

export function extensionOf(path: string): string | null {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : null;
}
