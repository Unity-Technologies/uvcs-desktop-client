import { canAnnotate } from '@shared/domain/annotate';
import type { TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { openTerminalIn } from '../../app/workspace/workspaceShellActions';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { filterRulesSubmenu, itemCopySubmenu } from '../pendingChanges/pendingChangeMenu';
import { absolutePath, undoChanges } from '../pendingChanges/pendingChangeOperations';
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
import { cutAction, pasteAction } from './cutPasteActions';
import { fileMenuTargets, hasRevisionsToShow } from './fileMenuTargets';
import { useFilesViewStore } from './filesViewStore';
import type { PendingChangesIndex } from './itemStatus';
import { isWorkspaceRoot } from './workspaceRoot';
import { hotkey } from '../../lib/shortcutRegistry';

export const FILE_SHORTCUTS = {
  rename: hotkey('rename'),
  delete: hotkey('deleteFile'),
  newFile: hotkey('newFile'),
  newFolder: hotkey('newFolder'),
  history: hotkey('fileHistory'),
  annotate: hotkey('annotate'),
  showChanges: hotkey('listDiff'),
};

/** The file annotated beside the tree, in the diff's place (from Go to file's actions too: the tree selects it). */
function showAnnotated(path: string): void {
  const view = useFilesViewStore.getState();
  view.setFileView('annotate');
  view.requestReveal(path);
}

/** The context menu of the selected items in the Files view. */
export function fileMenu(workspacePath: string, items: TreeItem[], pendingChanges: PendingChangesIndex): MenuEntry[] {
  if (items.length === 0) return [];

  const single = items.length === 1 ? items[0]! : null;
  const { privateItems, checkoutCandidates, undoable, typedFiles } = fileMenuTargets(items, pendingChanges);
  const directory = targetDirectoryFor(single ?? undefined);
  // The workspace root can't be renamed or deleted from here.
  const hasRoot = items.some(isWorkspaceRoot);

  return groupedMenu([
    single && single.itemType !== 'directory' && menuAction('open', () => openItem(workspacePath, single)),
    privateItems.length > 0 &&
      menuAction('add', () => void addItems(workspacePath, privateItems), {
        label: privateItems.some((item) => item.itemType === 'directory') ? 'Add to version control (recursively)' : 'Add to version control',
      }),
    checkoutCandidates.length > 0 && menuAction('checkout', () => void checkoutItems(workspacePath, checkoutCandidates)),
    single && menuAction('newFile', () => void createItem(workspacePath, directory, 'file'), { shortcut: FILE_SHORTCUTS.newFile }),
    single && menuAction('newFolder', () => void createItem(workspacePath, directory, 'directory'), { shortcut: FILE_SHORTCUTS.newFolder }),
    single &&
      !single.isPrivate &&
      single.itemType !== 'directory' &&
      menuAction('changes', () => useFilesViewStore.getState().setFileView('diff'), { shortcut: FILE_SHORTCUTS.showChanges }),
    // The root changes with every changeset: its history is the whole repository's.
    single &&
      hasRevisionsToShow(single, pendingChanges) &&
      !hasRoot &&
      menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path }), { shortcut: FILE_SHORTCUTS.history }),
    single &&
      hasRevisionsToShow(single, pendingChanges) &&
      canAnnotate(single.itemType) &&
      menuAction('annotate', () => showAnnotated(single.path), { shortcut: FILE_SHORTCUTS.annotate }),
    menuAction('locks', () => navigation.goToView('locks')),
    // The workspace opens as a folder; an item shows selected in the folder that holds it.
    single && isWorkspaceRoot(single) && menuAction('openFolder', () => void api.system.openPath(workspacePath)),
    single && !isWorkspaceRoot(single) && menuAction('reveal', () => revealItem(workspacePath, single)),
    single?.itemType === 'directory' && menuAction('terminal', () => openTerminalIn(absolutePath(workspacePath, single.path))),
    // Cut and Paste move items into another folder.
    !hasRoot && cutAction(workspacePath, items),
    itemCopySubmenu(workspacePath, items.map((item) => item.path)),
    pasteAction(workspacePath, items),
    single && !hasRoot && menuAction('rename', () => void renameItem(workspacePath, single), { shortcut: FILE_SHORTCUTS.rename }),
    typedFiles.length > 0 &&
      menuSubmenu('revisionType', [
        { id: 'type.bin', label: 'Binary', run: () => void changeRevisionType(workspacePath, typedFiles, 'bin') },
        { id: 'type.txt', label: 'Text', run: () => void changeRevisionType(workspacePath, typedFiles, 'txt') },
      ]),
    single && !hasRoot && filterRulesSubmenu(workspacePath, single.path),
    undoable.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, undoable), {
        label: undoable.length === 1 ? 'Undo changes…' : `Undo ${undoable.length} changes…`,
      }),
    !hasRoot && menuAction('delete', () => void deleteItems(workspacePath, items), { shortcut: FILE_SHORTCUTS.delete }),
  ]);
}
