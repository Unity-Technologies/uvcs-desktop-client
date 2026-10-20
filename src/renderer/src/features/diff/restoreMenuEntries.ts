import type { DiffEntry } from '@shared/domain/diff';
import type { DeletedItemRestore } from '@shared/domain/explorer';
import { menuAction } from '../../components/menuWords';
import type { GroupedEntry } from '../../lib/menuGroups';
import { pluralize } from '../../lib/text';
import { restoreDeletedItems, restoreDeletedItemTo } from './restoreDeleted';

/**
 * What restoring these entries of a diff brings back, each where it was: the revision each deletion removed. Null
 * unless every entry was deleted, in the workspace's own repository: `cm undelete` restores no xlinked item, and
 * finds the revision only in the workspace's repository (`undeleteArgs`).
 */
export function deletedItemRestores(entries: DiffEntry[], workspaceRepository: string | undefined): DeletedItemRestore[] | null {
  const restorable = (entry: DiffEntry) => entry.status === 'deleted' && entry.baseRevisionId >= 0 && workspaceRepository !== undefined && entry.repository === workspaceRepository;
  if (entries.length === 0 || !entries.every(restorable)) return null;
  return entries.map((entry) => ({ revision: { revisionId: entry.baseRevisionId, repository: entry.repository }, path: entry.path }));
}

/**
 * The menu entries that bring deleted items of a diff back as pending changes: where they were, or one of them
 * anywhere in the workspace ("Restore to…"). None for anything else a diff lists.
 */
export function restoreMenuEntries(workspacePath: string, entries: DiffEntry[], workspaceRepository: string | undefined): GroupedEntry[] {
  const restores = deletedItemRestores(entries, workspaceRepository);
  if (!restores) return [];
  const restore = menuAction('restore', () => void restoreDeletedItems(workspacePath, restores), { label: restoreLabel(entries) });
  if (restores.length > 1) return [restore];
  return [restore, menuAction('restoreTo', () => void restoreDeletedItemTo(workspacePath, restores[0]!))];
}

function restoreLabel(entries: DiffEntry[]): string {
  if (entries.length > 1) return `Restore ${pluralize(entries.length, 'item')}`;
  return entries[0]!.itemType === 'directory' ? 'Restore folder' : 'Restore file';
}
