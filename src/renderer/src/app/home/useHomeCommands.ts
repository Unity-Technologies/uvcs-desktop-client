import { FolderOpen, FolderPlus, House, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommands, type Command } from '../commands/commandStore';
import { queryClient } from '../queryClient';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';

/**
 * The home screen's commands. They take the ids of the workspace's own, so Home (⇧⌘H), File › Open Workspace… (⇧⌘O)
 * and View › Refresh (⌘R) work here too: back to the welcome, opening a folder, and reading the lists again.
 */
export function useHomeCommands(open: (path: string) => void, goHome: () => void): void {
  const commands = useMemo<Command[]>(
    () => [
      { id: 'app.home', group: 'Go to', label: 'Home', icon: House, shortcut: hotkey('home'), run: goHome },
      {
        id: 'workspace.open',
        group: 'Workspace',
        label: 'Open workspace folder…',
        icon: FolderOpen,
        shortcut: hotkey('openWorkspace'),
        run: () => void openWorkspaceFolder(open),
      },
      {
        id: 'home.newWorkspace',
        group: 'Workspace',
        label: 'New workspace…',
        icon: FolderPlus,
        keywords: ['create', 'download', 'repository'],
        run: () => openCreateWorkspaceDialog({ onCreated: open }),
      },
      {
        id: 'workspace.refresh',
        group: 'Workspace',
        label: 'Refresh',
        icon: RefreshCw,
        shortcut: hotkey('refresh'),
        run: () => void queryClient.invalidateQueries({ predicate: ({ queryKey }) => HOME_QUERIES.has(String(queryKey[0])) }),
      },
    ],
    [open, goHome],
  );
  useCommands(commands);
}

/** What the home screen lists: workspaces (with their heads and missing folders) and the repositories of the server shown. */
const HOME_QUERIES = new Set(['workspaces', 'workspaceHeads', 'missingWorkspacePaths', 'repositories']);
