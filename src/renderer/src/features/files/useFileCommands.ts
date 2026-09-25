import { FileDiff, FilePlus, FolderPlus, FolderTree, History, ScanText, Search, TextCursorInput, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { navigation } from '../../app/navigation/navigationStore';
import { prompt } from '../../ui/dialog/prompt';
import { FILE_SHORTCUTS } from './fileMenu';
import { createItem, deleteItems, renameItem, targetDirectoryFor } from './fileOperations';
import { useFilesViewStore } from './filesViewStore';
import { hotkey } from '../../lib/shortcutRegistry';

export const GO_TO_FILE_SHORTCUT = hotkey('goToFile');

async function browseRepositoryAtChangeset(): Promise<void> {
  const answer = await prompt({ title: 'Browse repository', label: 'Changeset number', confirmLabel: 'Browse' });
  const changesetId = Number.parseInt(answer ?? '', 10);
  if (Number.isInteger(changesetId) && changesetId >= 0) navigation.openPage({ kind: 'browseRepository', changesetId });
}

/** Palette commands and shortcuts of the Files view, acting on the current selection. */
export function useFileCommands(workspacePath: string, selected: TreeItem[], onGoToFile: () => void): void {
  const commands = useMemo<Command[]>(() => {
    const single = selected.length === 1 ? selected[0]! : undefined;
    const isControlledFile = Boolean(single && !single.isPrivate && single.itemType !== 'directory');
    const directory = targetDirectoryFor(single);

    return [
      { id: 'files.goTo', group: 'Files', label: 'Go to file…', icon: Search, shortcut: GO_TO_FILE_SHORTCUT, run: onGoToFile },
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
        shortcut: FILE_SHORTCUTS.newFile,
        run: () => void createItem(workspacePath, directory, 'file'),
      },
      {
        id: 'files.newFolder',
        group: 'Files',
        label: 'New folder…',
        icon: FolderPlus,
        shortcut: FILE_SHORTCUTS.newFolder,
        run: () => void createItem(workspacePath, directory, 'directory'),
      },
      {
        id: 'files.rename',
        group: 'Files',
        label: 'Rename selected item…',
        icon: TextCursorInput,
        shortcut: FILE_SHORTCUTS.rename,
        disabled: !single,
        run: () => single && void renameItem(workspacePath, single),
      },
      {
        id: 'files.delete',
        group: 'Files',
        label: 'Delete selected items',
        icon: Trash2,
        shortcut: FILE_SHORTCUTS.delete,
        disabled: selected.length === 0,
        run: () => void deleteItems(workspacePath, selected),
      },
      {
        id: 'files.history',
        group: 'Files',
        label: 'View history of selected item',
        icon: History,
        shortcut: FILE_SHORTCUTS.history,
        disabled: !single || single.isPrivate,
        run: () => single && navigation.openPage({ kind: 'history', path: single.path }),
      },
      {
        id: 'files.annotate',
        group: 'Files',
        label: 'Annotate selected file',
        icon: ScanText,
        shortcut: FILE_SHORTCUTS.annotate,
        disabled: !isControlledFile,
        run: () => single && navigation.openPage({ kind: 'annotate', path: single.path }),
      },
      {
        id: 'files.showChanges',
        group: 'Files',
        label: 'Show changes of selected file',
        icon: FileDiff,
        shortcut: FILE_SHORTCUTS.showChanges,
        disabled: !isControlledFile,
        run: () => useFilesViewStore.getState().setDetailsTab('changes'),
      },
    ];
  }, [workspacePath, selected, onGoToFile]);

  useCommands(commands);
}
