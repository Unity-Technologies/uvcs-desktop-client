import { FolderInput, ListPlus, Pencil, Text, Trash2 } from 'lucide-react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { SEPARATOR, tidyMenu, type MenuEntry, type Submenu } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { isControlled } from './changeCategories';
import { DEFAULT_CHANGELIST_LABEL } from './changeRows';
import {
  deleteChangelist,
  editChangelistDescription,
  moveToChangelist,
  moveToNewChangelist,
  renameChangelist,
} from './changelistOperations';

/** "Move to changelist" for the selected changes; null when none of them can be moved. */
export function moveToChangelistSubmenu(workspacePath: string, changes: PendingChange[], changelists: Changelist[]): Submenu | null {
  const movable = changes.filter(isControlled);
  if (movable.length === 0) return null;

  const current = new Set(movable.map((change) => change.changelist ?? null));
  const isOnlyIn = (name: string | null): boolean => current.size === 1 && current.has(name);

  return {
    label: 'Move to changelist',
    icon: FolderInput,
    entries: tidyMenu([
      { id: 'changelist.new', label: 'New changelist…', icon: ListPlus, run: () => void moveToNewChangelist(workspacePath, movable) },
      SEPARATOR,
      {
        id: 'changelist.default',
        label: DEFAULT_CHANGELIST_LABEL,
        disabled: isOnlyIn(null),
        run: () => void moveToChangelist(workspacePath, null, movable),
      },
      ...changelists.map((changelist) => ({
        id: `changelist.${changelist.name}`,
        label: changelist.name,
        disabled: isOnlyIn(changelist.name),
        run: () => void moveToChangelist(workspacePath, changelist.name, movable),
      })),
    ]),
  };
}

/** Actions for a changelist header. */
export function changelistMenu(workspacePath: string, changelist: Changelist): MenuEntry[] {
  return groupedMenu({
    edit: [
      { id: 'changelist.rename', label: 'Rename…', icon: Pencil, run: () => void renameChangelist(workspacePath, changelist) },
      { id: 'changelist.describe', label: 'Edit description…', icon: Text, run: () => void editChangelistDescription(workspacePath, changelist) },
    ],
    danger: [{ id: 'changelist.delete', label: 'Delete changelist…', icon: Trash2, danger: true, run: () => void deleteChangelist(workspacePath, changelist) }],
  });
}
