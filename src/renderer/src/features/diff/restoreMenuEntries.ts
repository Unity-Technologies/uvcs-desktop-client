import type { DiffEntry } from '@shared/domain/diff';
import type { DeletedItemRestore } from '@shared/domain/explorer';
import { inWorkspaceRepository } from '@shared/domain/repository';
import { menuAction } from '../../components/menuWords';
import type { GroupedEntry } from '../../lib/menuGroups';
import { fileNameOf, pluralize } from '../../lib/text';
import { restoreDeletedItems, restoreDeletedItemTo } from './restoreDeleted';

/**
 * What restoring these selected entries of a diff brings back, each where it was: the revision each deletion removed.
 * A file of a folder deleted with it comes back with the folder, the outermost one the diff deleted (`diffEntries`,
 * every entry, the folders its list hides included: `listedEntries`), as `cm` restores nothing into a folder that's
 * gone; one restore each, none inside another. Null unless every selected entry was deleted, in the workspace's own
 * repository, and none is an xlink: `cm undelete` restores no xlink nor xlinked item, and finds the revision only in
 * the workspace's repository (`undeleteArgs`).
 */
export function deletedItemRestores(selected: DiffEntry[], diffEntries: DiffEntry[], workspaceRepository: string | undefined): DeletedItemRestore[] | null {
  const restored = restoredEntries(selected, diffEntries, workspaceRepository);
  return restored && restored.map(restoreOf);
}

/**
 * The menu entries that bring deleted items of a diff back as pending changes: where they were, or one of them
 * anywhere in the workspace ("Restore to…"). None for anything else a diff lists.
 */
export function restoreMenuEntries(workspacePath: string, selected: DiffEntry[], diffEntries: DiffEntry[], workspaceRepository: string | undefined): GroupedEntry[] {
  const restored = restoredEntries(selected, diffEntries, workspaceRepository);
  if (!restored) return [];
  const restores = restored.map(restoreOf);
  const restore = menuAction('restore', () => void restoreDeletedItems(workspacePath, restores), { label: restoreLabel(restored, selected) });
  if (restores.length > 1) return [restore];
  return [restore, menuAction('restoreTo', () => void restoreDeletedItemTo(workspacePath, restores[0]!))];
}

function restoredEntries(selected: DiffEntry[], diffEntries: DiffEntry[], workspaceRepository: string | undefined): DiffEntry[] | null {
  const restorable = (entry: DiffEntry) =>
    entry.status === 'deleted' && entry.itemType !== 'xlink' && entry.baseRevisionId >= 0 && inWorkspaceRepository(entry.repository, workspaceRepository) === true;
  if (selected.length === 0 || !selected.every(restorable)) return null;
  const deletedFolders = diffEntries.filter((entry) => restorable(entry) && entry.itemType === 'directory');
  // The outermost deleted folder holding each item, or the item itself.
  const outermost = (entry: DiffEntry) => deletedFolders.filter((folder) => isInside(entry.path, folder.path)).sort((a, b) => a.path.length - b.path.length)[0] ?? entry;
  const byPath = new Map(selected.map(outermost).map((entry) => [entry.path, entry]));
  const restored = [...byPath.values()];
  return restored.filter((entry) => !restored.some((other) => isInside(entry.path, other.path)));
}

function isInside(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`);
}

function restoreOf(entry: DiffEntry): DeletedItemRestore {
  return { revision: { revisionId: entry.baseRevisionId, repository: entry.repository }, path: entry.path };
}

/** What comes back: a file, a folder, the folder a selected file comes back with, or a count. */
function restoreLabel(restored: DiffEntry[], selected: DiffEntry[]): string {
  if (restored.length > 1) return `Restore ${pluralize(restored.length, 'item')}`;
  const [only] = restored as [DiffEntry];
  if (only.itemType !== 'directory') return 'Restore file';
  return selected.length === 1 && selected[0]!.path === only.path ? 'Restore folder' : `Restore folder ${fileNameOf(only.path)}`;
}
