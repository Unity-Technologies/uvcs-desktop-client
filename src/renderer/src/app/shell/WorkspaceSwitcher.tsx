import * as Popover from '@radix-ui/react-popover';
import { Copy, FolderGit2, FolderOpen, FolderPlus, Layers, SquareTerminal } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { Icon } from '../../lib/actions';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { useSession } from '../workspace/sessionStore';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { copyWorkspacePath, openTerminalIn } from '../workspace/workspaceShellActions';
import { currentWorkspaceMenu } from './currentWorkspaceMenu';
import { WorkspaceSwitcherRows } from './WorkspaceSwitcherRows';
import styles from './WorkspaceSwitcher.module.css';

/**
 * Quick switch to any workspace, recent ones first, without going back to the home screen. Rows read as the home
 * screen's (the repository's avatar, the branch and the server); workspaces of the same repository also show their
 * pending changes. Right-clicking the card offers the open workspace's actions.
 */
export function WorkspaceSwitcher({ currentPath, children }: { currentPath: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const openWorkspace = useOpenWorkspace();
  const returnFocus = useReturnFocus(open);
  const workspaceName = useWorkspaceInfo().data?.name;

  // Popover actions often open a dialog or a folder picker: close first so focus goes where it should.
  const closeThen = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <ActionContextMenu entries={() => currentWorkspaceMenu(currentPath, workspaceName)}>
        <Popover.Trigger asChild>{children}</Popover.Trigger>
      </ActionContextMenu>
      <Popover.Portal>
        <Popover.Content className={styles.popover} side="bottom" align="start" sideOffset={4} {...returnFocus}>
          <WorkspaceSwitcherRows currentPath={currentPath} onChoose={(path) => closeThen(() => openWorkspace(path))()} />
          <div className={styles.footer}>
            <SwitcherAction icon={FolderOpen} onClick={closeThen(() => void openWorkspaceFolder(openWorkspace))}>
              Open folder…
            </SwitcherAction>
            <SwitcherAction icon={FolderPlus} onClick={closeThen(() => openCreateWorkspaceDialog({ onCreated: openWorkspace }))}>
              New workspace…
            </SwitcherAction>
            <SwitcherAction icon={FolderGit2} onClick={closeThen(() => openTaskWorkspaceDialog({ workspacePath: currentPath }))}>
              New workspace for a task…
            </SwitcherAction>
            <SwitcherAction icon={Layers} onClick={closeWorkspace}>
              All workspaces and repositories…
            </SwitcherAction>
          </div>
          <div className={styles.here}>
            <SwitcherAction icon={SquareTerminal} onClick={closeThen(() => openTerminalIn(currentPath))}>
              Open terminal here
            </SwitcherAction>
            <SwitcherAction icon={Copy} onClick={closeThen(() => copyWorkspacePath(currentPath))}>
              Copy workspace path
            </SwitcherAction>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SwitcherAction({ icon: ActionIcon, onClick, children }: { icon: Icon; onClick: () => void; children: ReactNode }) {
  return (
    <button className={styles.footerItem} onClick={onClick}>
      <ActionIcon size={14} />
      {children}
    </button>
  );
}
