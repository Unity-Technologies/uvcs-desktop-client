import { ListPlus } from 'lucide-react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { groupedMenu, type GroupedEntry } from '../../lib/menuGroups';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import type { CheckinMode } from './checkinButton';
import { changelistNameOf, isCheckinCandidate, isControlled, isShelvable } from './changeCategories';
import { DEFAULT_CHANGELIST_LABEL } from './changeRows';
import {
  deleteChangelist,
  editChangelistDescription,
  moveToChangelist,
  moveToNewChangelist,
  renameChangelist,
} from './changelistOperations';
import { undoChanges, undoChangesLabel } from './pendingChangeOperations';

/**
 * "Move to changelist" for the selected changes; null when none of them can be moved. `beforeMove` runs once the
 * changelist is known (picked, or a new one named), before anything moves.
 */
export function moveToChangelistSubmenu(
  workspacePath: string,
  changes: PendingChange[],
  changelists: Changelist[],
  beforeMove: () => void = () => {},
): GroupedEntry | null {
  const movable = changes.filter(isControlled);
  if (movable.length === 0) return null;
  const moveTo = (changelist: string | null): void => {
    beforeMove();
    void moveToChangelist(workspacePath, changelist, movable);
  };

  const current = new Set(movable.map(changelistNameOf));
  const isOnlyIn = (name: string | null): boolean => current.size === 1 && current.has(name);

  return menuSubmenu(
    'changelist',
    tidyMenu([
      {
        id: 'changelist.new',
        label: 'New changelist…',
        icon: ListPlus,
        run: () => void moveToNewChangelist(workspacePath, movable, beforeMove),
      },
      SEPARATOR,
      {
        id: 'changelist.default',
        label: DEFAULT_CHANGELIST_LABEL,
        disabled: isOnlyIn(null),
        run: () => moveTo(null),
      },
      ...changelists.map((changelist) => ({
        id: `changelist.${changelist.name}`,
        label: changelist.name,
        disabled: isOnlyIn(changelist.name),
        run: () => moveTo(changelist.name),
      })),
    ]),
  );
}

interface ChangelistMenuContext {
  /** The changes it holds, those the filters hide too: its menu acts on the whole changelist. */
  changes: PendingChange[];
  /** Readies the check-in panel to check in or shelve them (`prepareChangelistCheckin`). */
  prepare: (mode: CheckinMode) => void;
  /** Every user changelist, where "Move to changelist" can take its changes. */
  changelists: Changelist[];
  /** Clears Changes' filters before its changes move: those they hide move too, and the list then shows them all. */
  clearFilter: () => void;
}

/**
 * Whether a changelist header has a menu (`changelistMenu`), and so its "…": a user changelist always, as it can be
 * renamed or deleted; the default one while it holds a change its menu acts on, not only ignored or cloaked files.
 * Asked on every render of the header, so it stops at the first such change rather than building the menu.
 */
export function changelistHasMenu(changelist: Changelist | null, changes: PendingChange[]): boolean {
  return changelist !== null || changes.some((change) => isCheckinCandidate(change) || isControlled(change));
}

/**
 * Actions for a changelist header, null for the default changelist: every changelist offers the same menu, but for
 * what the default one can't do (be renamed, described or deleted), which isn't offered. Checking it in or shelving it
 * readies the check-in panel rather than running at once, so the user still reads its comment and presses the button;
 * moving or undoing its changes acts on all of them, as checking it in does. What acts on some of its files (checking
 * out, adding, ignoring, copying their paths) is in their own menu: select them, or right-click a folder.
 */
export function changelistMenu(workspacePath: string, changelist: Changelist | null, { changes, prepare, changelists, clearFilter }: ChangelistMenuContext): MenuEntry[] {
  const controlled = changes.filter(isControlled);
  return groupedMenu([
    changes.some(isCheckinCandidate) && menuAction('checkin', () => prepare('checkin'), { label: 'Check in this changelist' }),
    changes.some(isShelvable) && menuAction('shelve', () => prepare('shelve'), { label: 'Shelve this changelist' }),
    changelist && menuAction('rename', () => void renameChangelist(workspacePath, changelist)),
    changelist && menuAction('describe', () => void editChangelistDescription(workspacePath, changelist)),
    moveToChangelistSubmenu(workspacePath, changes, changelists, clearFilter),
    controlled.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, controlled), { label: undoChangesLabel(controlled.length) }),
    changelist && menuAction('delete', () => void deleteChangelist(workspacePath, changelist), { label: 'Delete changelist…' }),
  ]);
}
