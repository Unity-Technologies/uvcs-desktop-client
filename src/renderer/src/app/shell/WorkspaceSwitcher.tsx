import * as Popover from '@radix-ui/react-popover';
import { FolderOpen, FolderPlus, Layers } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { navigationTarget } from '../../lib/listNavigation';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { missingWorkspaceMenu, workspaceMenu } from '../home/homeMenus';
import { unlistedRecentPaths, type WorkspaceEntry } from '../home/recentWorkspaces';
import { useSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useMissingWorkspacePaths, useRecentWorkspaceRepositories, useWorkspaceList } from '../workspace/workspaceQueries';
import { workspaceSwitcherList } from './workspaceSwitcherList';
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
  const { data: workspaces = [] } = useWorkspaceList();
  const { data: repositories } = useRecentWorkspaceRepositories(workspaces);
  const { data: missingPaths = [] } = useMissingWorkspacePaths(unlistedRecentPaths(workspaces, recentWorkspacePaths));

  const { recent, others } = workspaceSwitcherList(workspaces, recentWorkspacePaths, missingPaths, currentPath, repositories, filter);
  const flat = [...recent, ...others];

  useEffect(() => {
    if (!movedByKeyboard.current) return;
    movedByKeyboard.current = false;
    listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);


  const onKeyDown = (event: KeyboardEvent): void => {
    const target = navigationTarget(event.key, highlighted, flat.length);
    if (target !== null) {
      event.preventDefault();
      movedByKeyboard.current = true;
      setHighlighted(target);
    } else if (event.key === 'Enter' && flat[highlighted]) {
      event.preventDefault();
      onChoose(flat[highlighted].workspace.path);
    }
  };

  // A missing workspace opens too: the workspace screen offers to locate, recreate or forget it.
  const row = ({ workspace, missing }: WorkspaceEntry, index: number) => {
    const repository = repositories?.[workspace.path];
    return (
      <ActionContextMenu key={workspace.guid} entries={() => (missing ? missingWorkspaceMenu : workspaceMenu)(workspace, onChoose)}>
        <button
          className={styles.item}
          data-highlighted={index === highlighted}
          data-missing={missing}
          onMouseEnter={() => setHighlighted(index)}
          onClick={() => onChoose(workspace.path)}
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
          {missing ? (
            <span className={styles.missing} data-tip="Its folder can't be found">
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
          {recent.map((entry, index) => row(entry, index))}
          {others.length > 0 && <div className={styles.groupTitle}>{recent.length > 0 ? 'Other workspaces' : 'Workspaces'}</div>}
          {others.map((entry, index) => row(entry, recent.length + index))}
        </HighlightQuery>
      </div>
    </>
  );
}
