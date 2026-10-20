import { ListPlus } from 'lucide-react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { groupedMenu, type GroupedEntry } from '../../lib/menuGroups';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import type { CheckinMode } from './checkinButton';
import { isCheckinCandidate, isControlled, isShelvable } from './changeCategories';
import { DEFAULT_CHANGELIST_LABEL } from './changeRows';
import {
  deleteChangelist,
  editChangelistDescription,
  moveToChangelist,
  moveToNewChangelist,
  renameChangelist,
} from './changelistOperations';
import { undoChanges, undoChangesLabel } from './pendingChangeOperations';

/** "Move to changelist" for the selected changes; null when none of them can be moved. */
export function moveToChangelistSubmenu(workspacePath: string, changes: PendingChange[], changelists: Changelist[]): GroupedEntry | null {
  const movable = changes.filter(isControlled);
  if (movable.length === 0) return null;

  const current = new Set(movable.map((change) => change.changelist ?? null));
  const isOnlyIn = (name: string | null): boolean => current.size === 1 && current.has(name);

  return menuSubmenu(
    'changelist',
    tidyMenu([
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
  );
}

interface ChangelistMenuContext {
  /** The changes it holds, those the filters hide too: its menu acts on the whole changelist. */
  changes: PendingChange[];
  /** Readies the check-in panel to check in or shelve them (`prepareChangelistCheckin`). */
  prepare: (mode: CheckinMode) => void;
}

/**
 * Actions for a changelist header. Checking it in or shelving it readies the check-in panel rather than running at
 * once, so the user still reads its comment and presses the button; undoing its changes asks as every undo does.
 */
export function changelistMenu(workspacePath: string, changelist: Changelist, { changes, prepare }: ChangelistMenuContext): MenuEntry[] {
  const controlled = changes.filter(isControlled);
  return groupedMenu([
    changes.some(isCheckinCandidate) && menuAction('checkin', () => prepare('checkin'), { label: 'Check in this changelist' }),
    changes.some(isShelvable) && menuAction('shelve', () => prepare('shelve'), { label: 'Shelve this changelist' }),
    menuAction('rename', () => void renameChangelist(workspacePath, changelist)),
    menuAction('describe', () => void editChangelistDescription(workspacePath, changelist)),
    controlled.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, controlled), { label: undoChangesLabel(controlled.length) }),
    menuAction('delete', () => void deleteChangelist(workspacePath, changelist), { label: 'Delete changelist…' }),
  ]);
}
