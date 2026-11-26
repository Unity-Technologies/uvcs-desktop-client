import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MissingChip } from '../../components/MissingChip';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { shownWorkspaceKind } from '../../components/workspaceKindWords';
import { navigationTarget } from '../../lib/listNavigation';
import { isRowMenuKey, showsRowActions } from '../../lib/rowMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { KeyHints } from '../../ui/KeyHints';
import { RowActionsButton } from '../../ui/menu/RowActionsButton';
import { missingWorkspaceMenu, workspaceMenu } from '../home/homeMenus';
import { unlistedRecentPaths, type WorkspaceEntry } from '../home/recentWorkspaces';
import { useDescribeWorkspace } from '../home/useDescribeWorkspace';
import { useSettings } from '../settings/useSettings';
import { usePlaceRepository } from '../workspace/useWorkspace';
import { windowAskedBy, type OpenWorkspaceIn } from '../workspace/workspaceWindowChoice';
import { useMissingWorkspacePaths, useWorkspaceList } from '../workspace/workspaceQueries';
import { WorkspaceSwitcherChips } from './WorkspaceSwitcherChips';
import { highlightedRow, workspaceSwitcherList } from './workspaceSwitcherList';
import styles from './WorkspaceSwitcher.module.css';

/**
 * The switcher's filter and its workspaces, recent ones first: the arrows move through them from the filter, Enter
 * opens the highlighted one (in a new window with Shift: `windowAskedBy`), and its "…", Tab or a right click opens its
 * actions.
 */
export function WorkspaceSwitcherRows({ currentPath, onChoose }: { currentPath: string | null; onChoose: OpenWorkspaceIn }) {
  const [filter, setFilter] = useState('');
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  /** The workspace whose actions are open. */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const movedByKeyboard = useRef(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces = [] } = useWorkspaceList();
  const describe = useDescribeWorkspace(workspaces);
  const currentRepository = usePlaceRepository();
  const { data: missingPaths = [] } = useMissingWorkspacePaths(unlistedRecentPaths(workspaces, recentWorkspacePaths));

  const { recent, others } = workspaceSwitcherList(workspaces, recentWorkspacePaths, missingPaths, currentPath, describe, filter);
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
      onChoose(flat[highlighted].workspace.path, windowAskedBy(event, flat[highlighted]));
    } else if (flat[highlighted] && isRowMenuKey(event)) {
      event.preventDefault();
      setMenuFor(flat[highlighted].workspace.path);
    }
  };

  // A missing workspace opens too: the workspace screen offers to locate, recreate or forget it.
  const row = (entry: WorkspaceEntry, index: number) => {
    const { workspace, missing } = entry;
    const menuOpen = workspace.path === menuFor;
    return (
      <div
        key={workspace.guid}
        id={`${listboxId}-${index}`}
        role="option"
        aria-selected={index === highlighted}
        className={styles.row}
        data-highlighted={index === highlighted}
        onMouseEnter={() => setHighlightedPath(workspace.path)}
        onContextMenu={(event) => {
          event.preventDefault();
          setHighlightedPath(workspace.path);
          setMenuFor(workspace.path);
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          className={styles.item}
          data-missing={missing}
          onClick={(event) => onChoose(workspace.path, windowAskedBy(event, { missing }))}
        >
          <RepositoryAvatar repository={entry.repository ?? entry.repositoryName} label={workspace.name} size={24} workspaceKind={shownWorkspaceKind(entry.kind, missing)} className={styles.avatar} />
          <span className={styles.text}>
            <span className={styles.name}>
              <Highlight text={workspace.name} />
            </span>
            <span className={styles.path}>
              <Highlight text={workspace.path} />
            </span>
          </span>
          {missing ? <MissingChip /> : <WorkspaceSwitcherChips entry={entry} sameRepository={!!entry.repository && entry.repository === currentRepository} />}
        </button>
        {showsRowActions({ highlighted: index === highlighted, menuOpen }) && (
          <RowActionsButton
            entries={() => (missing ? missingWorkspaceMenu(workspace, (path) => onChoose(path, 'here')) : workspaceMenu(workspace, onChoose))}
            open={menuOpen}
            onOpenChange={(open) => setMenuFor(open ? workspace.path : null)}
            // Back to the filter, so typing and the arrow keys carry on.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              filterRef.current?.focus();
            }}
          />
        )}
      </div>
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
      <KeyHints
        hints={[
          { keys: hotkey('workspaceInNewWindow'), label: 'new window' },
          { keys: hotkey('rowActions'), label: 'actions' },
        ]}
      />
    </>
  );
}
