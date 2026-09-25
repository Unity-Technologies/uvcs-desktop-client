import * as Popover from '@radix-ui/react-popover';
import { Archive, ChevronDown, GitBranch, GitBranchPlus, GitCommitVertical, Tag } from 'lucide-react';
import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { SelectorKind, WorkspaceInfo } from '@shared/domain/workspace';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import type { Icon } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { switchToBranch } from './branchOperations';
import { BranchSearchList, type BranchGroup } from './BranchSearchList';
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

const SELECTOR_PREFIXES: Record<SelectorKind, string> = {
  branch: '',
  changeset: 'Changeset ',
  label: 'Label ',
  shelve: 'Shelve ',
};

/** Shows what the workspace is loaded from and lets the user switch branches. */
export function WorkingObjectButton() {
  const { data: workspace } = useWorkspaceInfo();
  const { isOpen, setOpen } = useBranchSwitcher();
  useBranchCommands(workspace);

  const SelectorIcon = SELECTOR_ICONS[workspace?.selector.kind ?? 'branch'];

  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" icon={<SelectorIcon size={14} />} className={styles.trigger}>
          <span className={styles.selector}>{workspace ? `${SELECTOR_PREFIXES[workspace.selector.kind]}${workspace.selector.name}` : '…'}</span>
          <ChevronDown size={13} className={styles.chevron} />
        </Button>
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
  const groups = useMemo(() => switcherGroups(branches, recentNames), [branches, recentNames]);

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

function switcherGroups(branches: Branch[], recentNames: string[]): BranchGroup[] {
  const byName = new Map(branches.map((branch) => [branch.name, branch]));
  const main = branches.filter((branch) => !branch.parent);
  const recent = recentNames.map((name) => byName.get(name)).filter((branch): branch is Branch => Boolean(branch));
  const others = [...branches].sort((a, b) => a.name.localeCompare(b.name));

  return [
    { title: main.length === 1 ? 'Main branch' : 'Top-level branches', branches: main },
    { title: 'Recent', branches: recent },
    { title: 'All branches', branches: others },
  ];
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
