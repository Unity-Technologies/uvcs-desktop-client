import {
  AppWindow,
  Binary,
  Copy,
  FileDiff,
  FilePlus,
  FolderPlus,
  FolderSearch,
  History,
  Lock,
  PenLine,
  Plus,
  ScanText,
  TextCursorInput,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import { navigation } from '../../app/navigation/navigationStore';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { filterRulesSubmenu } from '../pendingChanges/pendingChangeMenu';
import { absolutePath, copyPaths, undoChanges } from '../pendingChanges/pendingChangeOperations';
import {
  addItems,
  changeRevisionType,
  checkoutItems,
  createItem,
  deleteItems,
  openItem,
  renameItem,
  revealItem,
  targetDirectoryFor,
} from './fileOperations';
import { useFilesViewStore } from './filesViewStore';
import type { PendingChangesIndex } from './itemStatus';

export const FILE_SHORTCUTS = {
  rename: 'f2',
  delete: 'mod+backspace',
  newFile: 'mod+shift+n',
  newFolder: 'mod+shift+d',
  history: 'mod+y',
  annotate: 'mod+t',
  showChanges: 'mod+d',
};

/** The context menu of the selected items in the Files view. */
export function fileMenu(workspacePath: string, items: TreeItem[], pendingChanges: PendingChangesIndex): MenuEntry[] {
  if (items.length === 0) return [];

  const single = items.length === 1 ? items[0]! : null;
  const privateItems = items.filter((item) => item.isPrivate);
  const controlled = items.filter((item) => !item.isPrivate);
  const changed = items.map((item) => pendingChanges.changeAt(item.path)).filter((change) => change !== undefined);
  const checkoutCandidates = controlled.filter((item) => !item.isCheckedOut && !pendingChanges.changeAt(item.path));
  const controlledFiles = controlled.filter((item) => item.itemType !== 'directory');
  const directory = targetDirectoryFor(single ?? undefined);

  return tidyMenu([
    single && single.itemType !== 'directory' && { id: 'open', label: 'Open', icon: AppWindow, run: () => openItem(workspacePath, single) },
    single && { id: 'reveal', label: 'Reveal in file manager', icon: FolderSearch, run: () => revealItem(workspacePath, single) },
    SEPARATOR,
    single && !single.isPrivate && single.itemType !== 'directory' && {
      id: 'changes',
      label: 'Show changes',
      icon: FileDiff,
      shortcut: FILE_SHORTCUTS.showChanges,
      run: () => useFilesViewStore.getState().setDetailsTab('changes'),
    },
    single && !single.isPrivate && {
      id: 'history',
      label: 'View history',
      icon: History,
      shortcut: FILE_SHORTCUTS.history,
      run: () => navigation.openPage({ kind: 'history', path: single.path }),
    },
    single && !single.isPrivate && single.itemType !== 'directory' && {
      id: 'annotate',
      label: 'Annotate',
      icon: ScanText,
      shortcut: FILE_SHORTCUTS.annotate,
      run: () => navigation.openPage({ kind: 'annotate', path: single.path }),
    },
    SEPARATOR,
    privateItems.length > 0 && {
      id: 'add',
      label: privateItems.some((item) => item.itemType === 'directory') ? 'Add to version control (recursively)' : 'Add to version control',
      icon: Plus,
      run: () => void addItems(workspacePath, privateItems),
    },
    checkoutCandidates.length > 0 && { id: 'checkout', label: 'Check out', icon: PenLine, run: () => void checkoutItems(workspacePath, checkoutCandidates) },
    changed.length > 0 && {
      id: 'undo',
      label: changed.length === 1 ? 'Undo changes' : `Undo ${changed.length} changes`,
      icon: Undo2,
      danger: true,
      run: () => void undoChanges(workspacePath, changed),
    },
    SEPARATOR,
    single && { id: 'rename', label: 'Rename…', icon: TextCursorInput, shortcut: FILE_SHORTCUTS.rename, run: () => void renameItem(workspacePath, single) },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, shortcut: FILE_SHORTCUTS.delete, run: () => void deleteItems(workspacePath, items) },
    SEPARATOR,
    single && {
      id: 'newFile',
      label: 'New file…',
      icon: FilePlus,
      shortcut: FILE_SHORTCUTS.newFile,
      run: () => void createItem(workspacePath, directory, 'file'),
    },
    single && {
      id: 'newFolder',
      label: 'New folder…',
      icon: FolderPlus,
      shortcut: FILE_SHORTCUTS.newFolder,
      run: () => void createItem(workspacePath, directory, 'directory'),
    },
    SEPARATOR,
    controlledFiles.length > 0 && {
      label: 'Revision type',
      icon: Binary,
      entries: [
        { id: 'type.bin', label: 'Binary', run: () => void changeRevisionType(workspacePath, controlledFiles, 'bin') },
        { id: 'type.txt', label: 'Text', run: () => void changeRevisionType(workspacePath, controlledFiles, 'txt') },
      ],
    },
    single && filterRulesSubmenu(workspacePath, single.path),
    {
      label: 'Copy',
      icon: Copy,
      entries: [
        { id: 'copy.relative', label: 'Copy relative path', run: () => copyPaths(items.map((item) => item.path)) },
        { id: 'copy.absolute', label: 'Copy full path', run: () => copyPaths(items.map((item) => absolutePath(workspacePath, item.path))) },
      ],
    },
    SEPARATOR,
    { id: 'locks', label: 'Show locks', icon: Lock, run: () => navigation.goToView('locks') },
  ]);
}
