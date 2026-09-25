import * as Popover from '@radix-ui/react-popover';
import { Archive, ChevronDown, GitBranch, GitBranchPlus, GitCommitVertical, Tag } from 'lucide-react';
import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { SelectorKind, WorkspaceInfo } from '@shared/domain/workspace';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useRunningOperation } from '../../app/operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { SELECTOR_KIND_LABELS, workingObjectName } from '../../components/workingObject';
import type { Icon } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { branchMenu } from './branchMenu';
import { switchToBranch } from './branchOperations';
import { BranchSearchList } from './BranchSearchList';
import { branchSwitcherGroups } from './branchSwitcherGroups';
import { useBranchSwitcher } from './branchSwitcherStore';
import { newBranchFromWorkspace } from './newBranchFromWorkspace';
import { useRecentBranches } from './recentBranchesStore';
import { useBranches } from './useBranches';
import styles from './WorkingObjectButton.module.css';

const SELECTOR_ICONS: Record<SelectorKind, Icon> = {
  branch: GitBranch,
  changeset: GitCommitVertical,
  label: Tag,
  shelve: Archive,
};

/** Shows what the workspace is loaded from and lets the user switch branches. */
export function WorkingObjectButton() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const running = useRunningOperation(workspacePath);
  const { isOpen, setOpen } = useBranchSwitcher();
  useBranchCommands(workspace);

  const switching = running?.kind === 'switch' ? running.title : null;
  const SelectorIcon = SELECTOR_ICONS[workspace?.selector.kind ?? 'branch'];
  const name = workspace ? workingObjectName(workspace.selector) : '…';

  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <ToolbarPill
          className={styles.trigger}
          emphasis="sub"
          icon={switching ? <Spinner size={13} /> : <SelectorIcon size={15} />}
          label={SELECTOR_KIND_LABELS[workspace?.selector.kind ?? 'branch']}
          sub={switching ? `${switching}…` : name}
          data-tip={switching ? undefined : 'Switch branch'}
          data-tip-shortcut={switching ? undefined : 'mod+shift+w'}
          trailing={<ChevronDown size={13} className={styles.chevron} />}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="start" sideOffset={6}>
          {workspace && <BranchSwitcher workspace={workspace} onDone={() => setOpen(false)} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BranchSwitcher({ workspace, onDone }: { workspace: WorkspaceInfo; onDone: () => void }) {
  const { data: branches = [] } = useBranches();
  const recentNames = useRecentBranches(workspace.path);
  const currentBranch = workspace.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const groups = useMemo(() => branchSwitcherGroups(branches, recentNames), [branches, recentNames]);

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
      menu={(branch) => branchMenu(workspace.path, [branch], currentBranch)}
      footer={
        <Button
          size="small"
          variant="ghost"
          icon={<GitBranchPlus size={13} />}
          onClick={() => {
            onDone();
            newBranchFromWorkspace(workspace);
          }}
        >
          New branch from here…
        </Button>
      }
    />
  );
}

function useBranchCommands(workspace: WorkspaceInfo | undefined): void {
  const setOpen = useBranchSwitcher((state) => state.setOpen);
  const commands = useMemo<Command[]>(
    () => [
      { id: 'branch.switch', group: 'Branch', label: 'Switch branch…', icon: GitBranch, shortcut: 'mod+shift+w', run: () => setOpen(true) },
      {
        id: 'branch.new',
        group: 'Branch',
        label: 'New branch…',
        icon: GitBranchPlus,
        shortcut: 'mod+b',
        disabled: !workspace,
        run: () => workspace && newBranchFromWorkspace(workspace),
      },
    ],
    [setOpen, workspace],
  );
  useCommands(commands);
}
