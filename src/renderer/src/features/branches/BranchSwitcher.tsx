import { GitBranchPlus } from 'lucide-react';
import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { COPY_ENTRY_IDS } from '../../components/copyMenu';
import { runningFirst } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { Button } from '../../ui/Button';
import { branchMenu } from './branchMenu';
import { switchToBranch } from './branchOperations';
import { BranchSearchList } from './BranchSearchList';
import { branchSwitcherGroups } from './branchSwitcherGroups';
import { newBranchFromWorkspace } from './newBranchFromWorkspace';
import { useRecentBranchGuids } from './recentBranches';
import { useBranches } from './useBranches';

/** The branch switcher's list (`branchSwitcherGroups`): picking a branch switches the workspace to it. */
export function BranchSwitcher({ workspace, onDone }: { workspace: WorkspaceInfo; onDone: () => void }) {
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
