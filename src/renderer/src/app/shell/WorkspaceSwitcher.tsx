import * as Popover from '@radix-ui/react-popover';
import { Copy, FolderGit2, FolderOpen, FolderPlus, Layers, SquareTerminal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import { initialOf } from '../../lib/initialOf';
import { navigationTarget } from '../../lib/listNavigation';
import { isRowMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { KeyHints } from '../../ui/KeyHints';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { missingWorkspaceMenu, workspaceMenu } from '../home/homeMenus';
import { unlistedRecentPaths, type WorkspaceEntry } from '../home/recentWorkspaces';
import { useSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { useMissingWorkspacePaths, useRecentWorkspaceRepositories, useWorkspaceList } from '../workspace/workspaceQueries';
import { copyWorkspacePath, openTerminalIn } from '../workspace/workspaceShellActions';
import { currentWorkspaceMenu } from './currentWorkspaceMenu';
import { WorkspaceGlance } from './WorkspaceGlance';
import { highlightedRow, workspaceSwitcherList } from './workspaceSwitcherList';
import styles from './WorkspaceSwitcher.module.css';

/**
 * Quick switch to any workspace, recent ones first, without going back to the home screen. Workspaces of the same
 * repository show their branch and pending changes. Right-clicking the card offers the open workspace's actions.
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
            <button className={styles.footerItem} onClick={closeThen(() => openTaskWorkspaceDialog({ workspacePath: currentPath }))}>
              <FolderGit2 size={14} />
              New workspace for a task…
            </button>
            <button className={styles.footerItem} onClick={closeWorkspace}>
              <Layers size={14} />
              All workspaces and repositories…
            </button>
          </div>
          <div className={styles.here}>
            <button className={styles.footerItem} onClick={closeThen(() => openTerminalIn(currentPath))}>
              <SquareTerminal size={14} />
              Open terminal here
            </button>
            <button className={styles.footerItem} onClick={closeThen(() => copyWorkspacePath(currentPath))}>
              <Copy size={14} />
              Copy workspace path
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function WorkspaceList({ currentPath, onChoose }: { currentPath: string; onChoose: (path: string) => void }) {
  const [filter, setFilter] = useState('');
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const movedByKeyboard = useRef(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces = [] } = useWorkspaceList();
  const { data: repositories } = useRecentWorkspaceRepositories(workspaces);
  const currentRepository = useWorkspaceInfo().data?.repository;
  const { data: missingPaths = [] } = useMissingWorkspacePaths(unlistedRecentPaths(workspaces, recentWorkspacePaths));

  const { recent, others } = workspaceSwitcherList(workspaces, recentWorkspacePaths, missingPaths, currentPath, repositories, filter);
  const flat = [...recent, ...others];
  const highlighted = highlightedRow(flat, highlightedPath);

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
      setHighlightedPath(flat[target]!.workspace.path);
    } else if (event.key === 'Enter' && flat[highlighted]) {
      event.preventDefault();
      onChoose(flat[highlighted].workspace.path);
    } else if (flat[highlighted] && isRowMenuKey(event)) {
      event.preventDefault();
      openContextMenuOf(document.getElementById(`${listboxId}-${highlighted}`));
    }
  };

  // A missing workspace opens too: the workspace screen offers to locate, recreate or forget it.
  const row = ({ workspace, missing }: WorkspaceEntry, index: number) => {
    const repository = repositories?.[workspace.path];
    return (
      <ActionContextMenu
        key={workspace.guid}
        entries={() => (missing ? missingWorkspaceMenu : workspaceMenu)(workspace, onChoose)}
        // Back to the filter, so typing and the arrow keys carry on.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          filterRef.current?.focus();
        }}
      >
        <button
          id={`${listboxId}-${index}`}
          role="option"
          aria-selected={index === highlighted}
          tabIndex={-1}
          className={styles.item}
          data-highlighted={index === highlighted}
          data-missing={missing}
          onMouseEnter={() => setHighlightedPath(workspace.path)}
          onClick={() => onChoose(workspace.path)}
        >
          <span className={styles.icon}>{initialOf(workspace.name)}</span>
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
          ) : repository && repository === currentRepository ? (
            <WorkspaceGlance workspacePath={workspace.path} />
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
        ref={filterRef}
        className={styles.filter}
        placeholder="Switch to workspace…"
        value={filter}
        spellCheck={false}
        role="combobox"
        aria-label="Switch to workspace"
        aria-expanded
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={flat[highlighted] ? `${listboxId}-${highlighted}` : undefined}
        onChange={(event) => {
          setFilter(event.target.value);
          setHighlightedPath(null);
        }}
        onKeyDown={onKeyDown}
        autoFocus
      />
      <div ref={listRef} id={listboxId} role="listbox" aria-label="Workspaces" className={styles.list}>
        {flat.length === 0 && <div className={styles.empty}>{filter ? 'No matching workspaces' : 'No other workspaces'}</div>}
        <HighlightQuery query={filter}>
          {recent.length > 0 && (
            <div role="presentation" className={styles.groupTitle}>
              Recent
            </div>
          )}
          {recent.map((entry, index) => row(entry, index))}
          {others.length > 0 && (
            <div role="presentation" className={styles.groupTitle}>
              {recent.length > 0 ? 'Other workspaces' : 'Workspaces'}
            </div>
          )}
          {others.map((entry, index) => row(entry, recent.length + index))}
        </HighlightQuery>
      </div>
      <KeyHints hints={[{ keys: hotkey('rowActions'), label: 'actions' }]} />
    </>
  );
}
