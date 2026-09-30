import type { RevisionType, TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { runAction, runRead } from '../../app/operations/runOperation';
import { isAffectedByPendingChangeEdit } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { absolutePath, deletePrivateFiles, fileName } from '../pendingChanges/pendingChangeOperations';
import { listedItems } from './directoryListing';
import { useFilesViewStore } from './filesViewStore';
import { parentOf } from './fileTreeRows';
import { itemNameProblem } from './itemName';

export function openItem(workspacePath: string, item: Pick<TreeItem, 'path'>): void {
  void runRead("Couldn't open the file", () => api.system.openPath(absolutePath(workspacePath, item.path)));
}

export function revealItem(workspacePath: string, item: Pick<TreeItem, 'path'>): void {
  void api.system.revealInFileManager(absolutePath(workspacePath, item.path));
}

/** Adds private items; directories are added with everything inside them. */
export function addItems(workspacePath: string, items: TreeItem[]): Promise<unknown> {
  const directories = items.filter((item) => item.itemType === 'directory').map((item) => item.path);
  const files = items.filter((item) => item.itemType !== 'directory').map((item) => item.path);

  return runAction(workspacePath, "Couldn't add the items", async () => {
    if (directories.length > 0) await api.explorer.addRecursive(workspacePath, directories);
    if (files.length > 0) await api.pendingChanges.add(workspacePath, files);
  }, isAffectedByPendingChangeEdit);
}

export function checkoutItems(workspacePath: string, items: TreeItem[]): Promise<unknown> {
  return runAction(workspacePath, "Couldn't check out the items", () =>
    api.pendingChanges.checkout(workspacePath, items.map((item) => item.path)),
    isAffectedByPendingChangeEdit,
  );
}

/** Deletes controlled items from version control (`cm remove`) and moves private ones to the trash. */
export async function deleteItems(workspacePath: string, items: TreeItem[]): Promise<void> {
  const privateItems = items.filter((item) => item.isPrivate);
  const controlled = items.filter((item) => !item.isPrivate);
  if (privateItems.length > 0) await deletePrivateFiles(workspacePath, privateItems);
  if (controlled.length === 0) return;

  const confirmed = await confirm({
    title: controlled.length === 1 ? `Delete ${controlled[0]!.name}?` : `Delete ${controlled.length} items?`,
    message: 'They are removed from disk and marked as deleted. Undo the change before checking in to get them back.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  await runAction(workspacePath, "Couldn't delete the items", () => api.pendingChanges.remove(workspacePath, controlled.map((item) => item.path)), isAffectedByPendingChangeEdit);
}

export async function renameItem(workspacePath: string, item: TreeItem): Promise<void> {
  const parent = parentOf(item.path);
  const siblings = listedNames(workspacePath, parent).filter((name) => name !== item.name);
  const newName = await prompt({
    title: `Rename ${item.name}`,
    label: 'New name',
    initialValue: item.name,
    confirmLabel: 'Rename',
    validate: (name) => itemNameProblem(name, siblings, { allowFolders: false }),
  });
  if (!newName || newName === item.name) return;

  const newPath = parent ? `${parent}/${newName}` : newName;
  await runAction(workspacePath, `Couldn't rename ${item.name}`, async () => {
    if (item.isPrivate) await api.explorer.renamePrivate(workspacePath, item.path, newPath);
    else await api.explorer.move(workspacePath, item.path, newPath);
    useFilesViewStore.getState().requestReveal(newPath);
  });
}

/** Asks for a name and creates a new, added file or directory inside `directory` (`''` is the root). */
export async function createItem(workspacePath: string, directory: string, kind: 'file' | 'directory'): Promise<void> {
  const noun = kind === 'file' ? 'file' : 'folder';
  const siblings = listedNames(workspacePath, directory);
  const name = await prompt({
    title: `New ${noun}`,
    label: 'Name',
    description: `Created in /${directory} and added to version control.`,
    confirmLabel: `Create ${noun}`,
    validate: (typed) => itemNameProblem(typed, siblings, { allowFolders: true }),
  });
  if (!name) return;

  const path = directory ? `${directory}/${name}` : name;
  await runAction(workspacePath, `Couldn't create ${fileName(path)}`, async () => {
    await api.explorer.create(workspacePath, path, kind);
    useFilesViewStore.getState().requestReveal(path);
  });
}

export function changeRevisionType(workspacePath: string, items: TreeItem[], type: RevisionType): Promise<unknown> {
  return runAction(workspacePath, "Couldn't change the revision type", () =>
    api.explorer.changeRevisionType(workspacePath, items.map((item) => item.path), type),
  );
}

/** The names in a folder, as far as its listing is read. */
function listedNames(workspacePath: string, directory: string): string[] {
  return listedItems(workspacePath, directory)?.map((item) => item.name) ?? [];
}

/** The directory new items go into: the selected directory itself, or the parent of the selected file. */
export function targetDirectoryFor(item: TreeItem | undefined): string {
  if (!item) return '';
  return item.itemType === 'directory' ? item.path : parentOf(item.path);
}
