import { FileDiff, FilePlus, FolderPlus, FolderTree, GitCommitHorizontal, History, Lock, ScanText, Search, TextCursorInput, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { navigation } from '../../app/navigation/navigationStore';
import { browseRepositoryAtChangeset } from '../browseRepository/browseRepositoryAtChangeset';
import { fileShortcuts } from './fileMenu';
import { createItem, deleteItems, renameItem, targetDirectoryFor } from './fileOperations';
import { filesCheckinChanges } from './filesCheckin';
import { checkinItems } from './filesCheckinOperation';
import { itemViews, type ItemViews } from './fileMenuTargets';
import type { PendingChangesIndex } from './itemStatus';
import { isWorkspaceRoot } from './workspaceRoot';
import { showFileView, toggleAnnotated } from './filesViewStore';
import { showInLocks } from '../locks/showInLocks';
import type { PendingLocks } from '../pendingChanges/locks/pendingLocks';
import { hotkey } from '../../lib/shortcutRegistry';
import { useKeymap } from '../../lib/keymapStore';


const NO_VIEWS: ItemViews = { history: false, annotate: false, changes: false };

/** Palette commands and shortcuts of the Files view, acting on the current selection. */
export function useFileCommands(
  workspacePath: string,
  selected: TreeItem[],
  pendingChanges: PendingChangesIndex,
  locks: PendingLocks,
  onGoToFile: () => void,
): void {
  const keymap = useKeymap();
  const commands = useMemo<Command[]>(() => {
    const single = selected.length === 1 ? selected[0]! : undefined;
    const lock = single && locks.get(single.path);
    const keys = fileShortcuts();
    const views = single ? itemViews(single, pendingChanges) : NO_VIEWS;
    const directory = targetDirectoryFor(single);
    const hasRoot = selected.some(isWorkspaceRoot);
    const checkinable = filesCheckinChanges(selected, pendingChanges.changes);

    return [
      { id: 'files.goTo', group: 'Files', label: 'Go to file…', icon: Search, shortcut: hotkey('goToFile'), run: () => onGoToFile() },
      {
        id: 'files.browseRepository',
        group: 'Files',
        label: 'Browse repository at changeset…',
        icon: FolderTree,
        run: () => void browseRepositoryAtChangeset(),
      },
      {
        id: 'files.newFile',
        group: 'Files',
        label: 'New file…',
        icon: FilePlus,
        shortcut: keys.newFile,
        run: () => void createItem(workspacePath, directory, 'file'),
      },
      {
        id: 'files.newFolder',
        group: 'Files',
        label: 'New folder…',
        icon: FolderPlus,
        shortcut: keys.newFolder,
        run: () => void createItem(workspacePath, directory, 'directory'),
      },
      {
        id: 'files.rename',
        group: 'Files',
        label: 'Rename selected item…',
        icon: TextCursorInput,
        shortcut: keys.rename,
        disabled: !single || hasRoot,
        run: () => single && !hasRoot && void renameItem(workspacePath, single),
      },
      {
        id: 'files.delete',
        group: 'Files',
        label: 'Delete selected items',
        icon: Trash2,
        shortcut: keys.delete,
        disabled: selected.length === 0 || hasRoot,
        run: () => !hasRoot && void deleteItems(workspacePath, selected),
      },
      {
        id: 'files.checkin',
        group: 'Files',
        label: 'Check in selected items…',
        icon: GitCommitHorizontal,
        disabled: checkinable.length === 0,
        run: () => checkinable.length > 0 && void checkinItems(workspacePath, checkinable, pendingChanges.changes),
      },
      {
        id: 'files.history',
        group: 'Files',
        label: 'View history of selected item',
        icon: History,
        shortcut: keys.history,
        disabled: !views.history,
        run: () => single && views.history && navigation.openPage({ kind: 'history', path: single.path }),
      },
      {
        id: 'files.annotate',
        group: 'Files',
        label: 'Annotate selected file, or back to its diff',
        icon: ScanText,
        shortcut: keys.annotate,
        disabled: !views.annotate,
        // The pane's "Diff | Annotate" (`fileViewForAnnotateCommand`): with the panel hidden, it opens the panel annotated.
        run: () => views.annotate && toggleAnnotated(),
      },
      {
        id: 'files.showChanges',
        group: 'Files',
        label: 'Show changes of selected file',
        icon: FileDiff,
        shortcut: keys.showChanges,
        disabled: !views.changes,
        run: () => showFileView('diff'),
      },
      {
        id: 'files.showInLocks',
        group: 'Files',
        label: 'Show lock of selected file in Locks',
        icon: Lock,
        disabled: !lock,
        run: () => lock && showInLocks(workspacePath, lock),
      },
    ];
  }, [keymap, workspacePath, selected, pendingChanges, locks, onGoToFile]);

  useCommands(commands);
}
