import type { TreeItem } from '@shared/domain/explorer';
import { isWritable, repositoryLinkTo } from '../../app/links/linkTo';
import { navigation } from '../../app/navigation/navigationStore';
import { queryClient } from '../../app/queryClient';
import { workspaceInfoQuery } from '../../app/workspace/useWorkspace';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { showInLocks } from '../locks/showInLocks';
import { itemPathPermissionsUnavailable, openItemPathPermissions } from '../permissions/openPermissions';
import type { PendingLocks } from '../pendingChanges/locks/pendingLocks';
import { filterRulesSubmenu, itemCopySubmenu } from '../pendingChanges/pendingChangeMenu';
import { absolutePath, undoChanges } from '../pendingChanges/pendingChangeOperations';
import {
  addItems,
  changeRevisionType,
  checkoutItems,
  createItem,
  deleteItems,
  renameItem,
  targetDirectoryFor,
} from './fileOperations';
import { cutAction, pasteAction } from './cutPasteActions';
import { filesItemLink } from './filesItemLink';
import { fileMenuTargets, itemViews } from './fileMenuTargets';
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
function showAnnotated(workspacePath: string, path: string): void {
  const view = useFilesViewStore.getState();
  view.setFileView('annotate');
  view.requestReveal(workspacePath, path);
}

/**
 * The link to an item, on what the workspace is on (`filesItemLink`), from the workspace's info its window already
 * read; none for an item no link names (private, under an xlink) or before the info is read.
 */
export function itemLinkText(workspacePath: string, item: TreeItem): string | null {
  const workspace = queryClient.getQueryData(workspaceInfoQuery(workspacePath).queryKey);
  const target = workspace ? filesItemLink(workspace, item) : null;
  return workspace && target && isWritable(target) ? repositoryLinkTo(workspace.repository, target) : null;
}

/** Who may check in under the item's path, on every branch (a secured path). */
function pathPermissionsAction(workspacePath: string, item: TreeItem) {
  const unavailable = itemPathPermissionsUnavailable(workspacePath, item.repository);
  return menuAction('pathPermissions', () => openItemPathPermissions(workspacePath, item.path), { disabled: Boolean(unavailable), disabledReason: unavailable });
}

/** The context menu of the selected items in the Files view; `locks` left out where they aren't read (Go to file). */
export function fileMenu(workspacePath: string, items: TreeItem[], pendingChanges: PendingChangesIndex, locks: PendingLocks = new Map()): MenuEntry[] {
  if (items.length === 0) return [];

  const single = items.length === 1 ? items[0]! : null;
  const lock = single ? locks.get(single.path) : undefined;
  const { privateItems, checkoutCandidates, undoable, typedFiles } = fileMenuTargets(items, pendingChanges);
  const views = single && itemViews(single, pendingChanges);
  const directory = targetDirectoryFor(single ?? undefined);
  // The workspace root can't be renamed or deleted from here.
  const hasRoot = items.some(isWorkspaceRoot);

  return groupedMenu([
    privateItems.length > 0 &&
      menuAction('add', () => void addItems(workspacePath, privateItems), {
        label: privateItems.some((item) => item.itemType === 'directory') ? 'Add to version control (recursively)' : 'Add to version control',
      }),
    checkoutCandidates.length > 0 && menuAction('checkout', () => void checkoutItems(workspacePath, checkoutCandidates)),
    single && menuAction('newFile', () => void createItem(workspacePath, directory, 'file'), { shortcut: FILE_SHORTCUTS.newFile }),
    single && menuAction('newFolder', () => void createItem(workspacePath, directory, 'directory'), { shortcut: FILE_SHORTCUTS.newFolder }),
    single && views?.changes && menuAction('changes', () => useFilesViewStore.getState().setFileView('diff'), { shortcut: FILE_SHORTCUTS.showChanges }),
    single && views?.history && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path }), { shortcut: FILE_SHORTCUTS.history }),
    single && views?.annotate && menuAction('annotate', () => showAnnotated(workspacePath, single.path), { shortcut: FILE_SHORTCUTS.annotate }),
    lock ? menuAction('showInLocks', () => showInLocks(workspacePath, lock)) : menuAction('locks', () => navigation.goToView('locks')),
    ...(single ? openOnDiskEntries({ path: absolutePath(workspacePath, single.path), isFolder: single.itemType === 'directory' }) : []),
    // Cut and Paste move items into another folder.
    !hasRoot && cutAction(workspacePath, items),
    itemCopySubmenu(workspacePath, items.map((item) => item.path), single ? itemLinkText(workspacePath, single) : null),
    pasteAction(workspacePath, items),
    single && !hasRoot && menuAction('rename', () => void renameItem(workspacePath, single), { shortcut: FILE_SHORTCUTS.rename }),
    typedFiles.length > 0 &&
      menuSubmenu('revisionType', [
        { id: 'type.bin', label: 'Binary', run: () => void changeRevisionType(workspacePath, typedFiles, 'bin') },
        { id: 'type.txt', label: 'Text', run: () => void changeRevisionType(workspacePath, typedFiles, 'txt') },
      ]),
    !hasRoot && filterRulesSubmenu(workspacePath, items.map((item) => item.path)),
    single && !single.isPrivate && pathPermissionsAction(workspacePath, single),
    undoable.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, undoable), {
        label: undoable.length === 1 ? 'Undo changes…' : `Undo ${undoable.length} changes…`,
      }),
    !hasRoot && menuAction('delete', () => void deleteItems(workspacePath, items), { shortcut: FILE_SHORTCUTS.delete }),
  ]);
}
