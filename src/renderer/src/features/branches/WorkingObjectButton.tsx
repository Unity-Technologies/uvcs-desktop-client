import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, GitBranch, GitBranchPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { WorkspaceInfo, WorkspaceSelector } from '@shared/domain/workspace';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useRunningOperationOfKind } from '../../app/operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { COPY_ENTRY_IDS } from '../../components/copyMenu';
import { PathLabel } from '../../components/PathLabel';
import { SELECTOR_ICONS, workingObjectName } from '../../components/workingObject';
import { runningFirst } from '../../lib/actions';
import { holdBackMenuKeyRelease, isListMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { Button } from '../../ui/Button';
import { ringValue } from '../../app/operations/progressBar';
import { ProgressRing } from '../../ui/ProgressRing';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { branchMenu } from './branchMenu';
import { switchToBranch } from './branchOperations';
import { BranchSearchList } from './BranchSearchList';
import { branchSwitcherGroups } from './branchSwitcherGroups';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { useBranchSwitcher } from './branchSwitcherStore';
import { newBranchFromWorkspace } from './newBranchFromWorkspace';
import { useRecentBranchGuids } from './recentBranches';
import { useBranches } from './useBranches';
import { useWorkingObject } from './useWorkingObject';
import { useWorkingObjectComment } from './useWorkingObjectComment';
import { workingObjectMenu } from './workingObjectMenu';
import styles from './WorkingObjectButton.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/** Shows what the workspace is loaded from and lets the user switch branches; right-click for that object's menu. */
export function WorkingObjectButton() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const runningSwitch = useRunningOperationOfKind(workspacePath, 'switch');
  const { isOpen, setOpen } = useBranchSwitcher();
  const returnFocus = useReturnFocus(isOpen);
  useBranchCommands(workspace);

  const switching = runningSwitch?.title ?? null;
  const switchBar = runningSwitch?.bar ?? null;
  const SelectorIcon = SELECTOR_ICONS[workspace?.selector.kind ?? 'branch'];
  const title = workspace ? workingObjectTitle(workspace.selector) : '…';
  const { data: comment } = useWorkingObjectComment(workspace);
  const firstLine = comment?.split('\n', 1)[0]?.trim();
  // Right-click (or the context-menu key, Shift+F10) offers what the workspace is on, as its list does; what that
  // needs is read once the pointer or focus is on the pill.
  const [menuWanted, setMenuWanted] = useState(false);
  const workingObject = useWorkingObject(workspace, menuWanted);
  const wantMenu = (): void => setMenuWanted(true);

  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      <ActionContextMenu entries={() => (workspace ? workingObjectMenu(workspace, workingObject) : [])}>
        <Popover.Trigger asChild>
          <ToolbarPill
            onPointerEnter={wantMenu}
            onFocus={wantMenu}
            onKeyDown={(event) => {
              if (!isListMenuKey(event)) return;
              event.preventDefault();
              openContextMenuOf(event.currentTarget);
            }}
            onKeyUp={holdBackMenuKeyRelease}
            className={styles.trigger}
            icon={switchBar ? <ProgressRing value={ringValue(switchBar)} size={14} /> : <SelectorIcon size={15} />}
            label={switching ? `${switching}…` : workspace?.selector.kind === 'branch' ? <PathLabel path={title} fitContent tooltip={false} /> : title}
            sub={switching || comment === undefined ? undefined : firstLine || <span className={styles.noComment}>No comment</span>}
            data-tip={switching ? undefined : title}
            data-tip-sub={switching ? undefined : comment?.trim() || undefined}
            data-tip-shortcut={switching ? undefined : hotkey('switchBranch')}
            trailing={<ChevronDown size={14} className={styles.chevron} />}
          />
        </Popover.Trigger>
      </ActionContextMenu>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="start" sideOffset={6} {...returnFocus}>
          {workspace && <BranchSwitcher workspace={workspace} onDone={() => setOpen(false)} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The pill's first line: the branch name as is; `cs:42` and `sh:3` explain themselves, a bare label name doesn't. */
function workingObjectTitle(selector: WorkspaceSelector): string {
  const name = workingObjectName(selector);
  return selector.kind === 'label' ? `Label ${name}` : name;
}

function BranchSwitcher({ workspace, onDone }: { workspace: WorkspaceInfo; onDone: () => void }) {
  const { data: branches = [] } = useBranches();
  const recentGuids = useRecentBranchGuids(workspace.path);
  const currentBranch = workspace.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const groups = useMemo(() => branchSwitcherGroups(branches, recentGuids), [branches, recentGuids]);

  const pick = (branch: Branch): void => {
    onDone();
    if (branch.name !== currentBranch) void switchToBranch(workspace.path, branch.name);
  };

  return (
    <BranchSearchList
      groups={groups}
      currentBranch={currentBranch}
      placeholder="Switch to branch…"
      onPick={pick}
      // Actions close the popup first (dialogs and pages open without it on top); copying keeps it open.
      menu={(branch) => runningFirst(branchMenu(workspace.path, [branch], currentBranch), onDone, COPY_ENTRY_IDS)}
      action={
        <Button
          size="small"
          variant="secondary"
          icon={<GitBranchPlus size={13} />}
          data-tip="New branch from what the workspace is loaded from"
          data-tip-shortcut={hotkey('newBranch')}
          onClick={() => {
            onDone();
            newBranchFromWorkspace(workspace);
          }}
        >
          New branch
        </Button>
      }
    />
  );
}

function useBranchCommands(workspace: WorkspaceInfo | undefined): void {
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
