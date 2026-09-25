import * as Popover from '@radix-ui/react-popover';
import { FolderOpen, FolderPlus, Layers, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { toast } from '../../ui/toast/toastStore';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { workspaceMenu } from '../home/homeMenus';
import { forgetRecentWorkspace, useSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useRecentWorkspaceRepositories, useWorkspaceList } from '../workspace/workspaceQueries';
import { workspaceSwitcherList, type SwitcherWorkspace } from './workspaceSwitcherList';
import styles from './WorkspaceSwitcher.module.css';

/** Quick switch to any workspace, recent ones first, without going back to the home screen. */
export function WorkspaceSwitcher({ currentPath, children }: { currentPath: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const openWorkspace = useOpenWorkspace();

  // Popover actions often open a dialog or a folder picker: close first so focus goes where it should.
  const closeThen = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} side="bottom" align="start" sideOffset={4}>
          <WorkspaceList currentPath={currentPath} onChoose={(path) => closeThen(() => openWorkspace(path))()} />
          <div className={styles.footer}>
            <button className={styles.footerItem} onClick={closeThen(() => void openWorkspaceFolder(openWorkspace))}>
              <FolderOpen size={14} />
              Open folder…
            </button>
            <button className={styles.footerItem} onClick={closeThen(() => openCreateWorkspaceDialog({ onCreated: openWorkspace }))}>
              <FolderPlus size={14} />
              New workspace…
            </button>
            <button className={styles.footerItem} onClick={closeWorkspace}>
              <Layers size={14} />
              All workspaces and repositories…
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function WorkspaceList({ currentPath, onChoose }: { currentPath: string; onChoose: (path: string) => void }) {
  const [filter, setFilter] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const movedByKeyboard = useRef(false);
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces } = useWorkspaceList();
  const { data: repositories } = useRecentWorkspaceRepositories(workspaces);

  const { recent, others } = workspaceSwitcherList(workspaces, recentWorkspacePaths, currentPath, repositories, filter);
  const flat = [...recent, ...others];

  useEffect(() => {
    if (!movedByKeyboard.current) return;
    movedByKeyboard.current = false;
    listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const choose = (workspace: SwitcherWorkspace): void => {
    if (workspace.missing) toast.error(`${workspace.name} is gone`, new Error(`${workspace.path} is no longer a workspace. Right-click it to remove it from the list.`));
    else onChoose(workspace.path);
  };

  const menu = (workspace: SwitcherWorkspace): MenuEntry[] =>
    workspace.missing
      ? [{ id: 'forget', label: 'Remove from recent', icon: X, run: () => void forgetRecentWorkspace(workspace.path) }]
      : workspaceMenu(workspace, onChoose);

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = navigationTarget(event.key, highlighted, flat.length);
    if (target !== null) {
      event.preventDefault();
      movedByKeyboard.current = true;
      setHighlighted(target);
    } else if (event.key === 'Enter' && flat[highlighted]) {
      event.preventDefault();
      choose(flat[highlighted]);
    }
  };

  const row = (workspace: SwitcherWorkspace, index: number) => {
    const repository = repositories?.[workspace.path];
    return (
      <ActionContextMenu key={workspace.guid} entries={() => menu(workspace)}>
        <button
          className={styles.item}
          data-highlighted={index === highlighted}
          data-missing={workspace.missing}
          onMouseEnter={() => setHighlighted(index)}
          onClick={() => choose(workspace)}
        >
          <span className={styles.icon}>{workspace.name.charAt(0).toUpperCase()}</span>
          <span className={styles.text}>
            <span className={styles.name}>
              <Highlight text={workspace.name} />
            </span>
            <span className={styles.path}>
              <Highlight text={workspace.path} />
            </span>
          </span>
          {workspace.missing ? (
            <span className={styles.missing} data-tip="Its folder was moved or deleted. Right-click to remove it from the list.">
              Missing
            </span>
          ) : (
            repository && (
              <span className={styles.repository}>
                <Highlight text={repository} />
              </span>
            )
          )}
        </button>
      </ActionContextMenu>
    );
  };

  return (
    <>
      <input
        className={styles.filter}
        placeholder="Switch to workspace…"
        value={filter}
        spellCheck={false}
        onChange={(event) => {
          setFilter(event.target.value);
          setHighlighted(0);
        }}
        onKeyDown={onKeyDown}
        autoFocus
      />
      <div ref={listRef} className={styles.list}>
        {flat.length === 0 && <div className={styles.empty}>{filter ? 'No matching workspaces' : 'No other workspaces'}</div>}
        <HighlightQuery query={filter}>
          {recent.length > 0 && <div className={styles.groupTitle}>Recent</div>}
          {recent.map((workspace, index) => row(workspace, index))}
          {others.length > 0 && <div className={styles.groupTitle}>{recent.length > 0 ? 'Other workspaces' : 'Workspaces'}</div>}
          {others.map((workspace, index) => row(workspace, recent.length + index))}
        </HighlightQuery>
      </div>
    </>
  );
}
