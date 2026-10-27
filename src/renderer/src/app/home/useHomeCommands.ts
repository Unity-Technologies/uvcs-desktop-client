import { FolderOpen, FolderPlus, House, Link, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { useCommands, type Command } from '../commands/commandStore';
import { queryClient } from '../queryClient';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';

/**
 * The home screen's commands. They take the ids of the workspace's own, so Home (⇧⌘H), File › Open Workspace… (⇧⌘O),
 * View › Refresh (⌘R) and Copy link (⇧⌘C) work here too: back to the welcome, opening a folder, reading the lists
 * again, and a link to the repositories shown (`homeLink`).
 */
export function useHomeCommands(open: (path: string) => void, goHome: () => void, link: string | null): void {
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
      {
        id: 'workspace.copyLink',
        group: 'Workspace',
        label: 'Copy link',
        icon: Link,
        keywords: ['share', 'url', 'uvcs'],
        shortcut: hotkey('copyLink'),
        disabled: link === null,
        run: () => link && copyToClipboard(link, 'Link'),
      },
    ],
    [open, goHome, link],
  );
  useCommands(commands);
}

/** What the home screen lists: workspaces (with their heads and missing folders) and the repositories of the server shown. */
const HOME_QUERIES = new Set(['workspaces', 'workspaceHeads', 'missingWorkspacePaths', 'repositories']);
