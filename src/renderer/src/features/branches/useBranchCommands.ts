import { GitBranch, GitBranchPlus } from 'lucide-react';
import { useMemo } from 'react';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { hotkey } from '../../lib/shortcutRegistry';
import { useBranchSwitcher } from './branchSwitcherStore';
import { newBranchFromWorkspace } from './newBranchFromWorkspace';

/** The palette's Switch branch… (opening the branch switcher) and New branch… (from what the workspace has loaded). */
export function useBranchCommands(workspace: WorkspaceInfo | undefined): void {
  const setOpen = useBranchSwitcher((state) => state.setOpen);
  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'branch.switch',
        group: 'Branch',
        label: 'Switch branch…',
        icon: GitBranch,
        shortcut: hotkey('switchBranch'),
        run: () => setOpen(true),
      },
      {
        id: 'branch.new',
        group: 'Branch',
        label: 'New branch…',
        icon: GitBranchPlus,
        shortcut: hotkey('newBranch'),
        disabled: !workspace,
        run: () => workspace && newBranchFromWorkspace(workspace),
      },
    ],
    [setOpen, workspace],
  );
  useCommands(commands);
}
