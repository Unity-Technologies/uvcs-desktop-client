import * as Popover from '@radix-ui/react-popover';
import { CodeXml, Copy, FolderGit2, FolderPlus, FolderSearch, Layers, SquareTerminal } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { defaultEditor, defaultTerminal, useExternalApps } from '../../components/externalApps/externalApps';
import { openInEditor } from '../../components/externalApps/externalAppOperations';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import { OPEN_IN_FILE_MANAGER_LABEL } from '../../lib/platform';
import type { Icon } from '../../lib/actions';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { useSession } from '../workspace/sessionStore';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { copyWorkspacePath, openTerminalIn, openWorkspaceInFileManager } from '../workspace/workspaceShellActions';
import { currentWorkspaceMenu } from './currentWorkspaceMenu';
import { WorkspaceSwitcherRows } from './WorkspaceSwitcherRows';
import styles from './WorkspaceSwitcher.module.css';

/**
 * Quick switch to any workspace, recent ones first, without going back to the home screen. Rows read as the home
 * screen's (the repository's avatar, the branch and the server); workspaces of the same repository also show their
 * pending changes. Right-clicking the card offers the open workspace's actions. A folder `cm` doesn't list as a
 * workspace is opened from File ▸ Open Another Workspace… (⇧⌘O), the home screen or by dropping it on the window:
 * here, beside the workspaces listed, "Open folder…" read as showing the folder in the file manager.
 */
export function WorkspaceSwitcher({ currentPath, children }: { currentPath: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const openWorkspace = useOpenWorkspace();
  const returnFocus = useReturnFocus(open);
  const workspaceName = useWorkspaceInfo().data?.name;
  const apps = useExternalApps();
  const editor = defaultEditor(apps);
  const terminal = defaultTerminal(apps);

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
            {editor?.opensFolders && (
              <SwitcherAction icon={CodeXml} onClick={closeThen(() => void openInEditor(currentPath))}>
                Open in {editor.name}
              </SwitcherAction>
            )}
            <SwitcherAction icon={SquareTerminal} onClick={closeThen(() => openTerminalIn(currentPath))}>
              {terminal ? `Open in ${terminal.name}` : 'Open terminal here'}
            </SwitcherAction>
            <SwitcherAction icon={FolderSearch} onClick={closeThen(() => openWorkspaceInFileManager(currentPath))}>
              {OPEN_IN_FILE_MANAGER_LABEL}
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
      <span className={styles.footerLabel}>{children}</span>
    </button>
  );
}
