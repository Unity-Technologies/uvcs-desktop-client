import { GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PathLabel } from '../../components/PathLabel';
import { FilterOptions } from '../../ui/FilterOptions';
import { FilterPopover } from '../../ui/FilterPopover';
import { CenteredSpinner } from '../../ui/Spinner';
import { MenuChip } from '../../ui/ToggleChip';
import { BranchSearchList } from '../branches/BranchSearchList';
import { branchSwitcherGroups } from '../branches/branchSwitcherGroups';
import { useRecentBranchGuids } from '../branches/recentBranches';
import { useBranches } from '../branches/useBranches';
import type { BranchScope } from './changesetFilters';

/** A branch picked by name, fitted to the chip: long nested names keep their own name whole (`PathLabel`). */
const PICKED_BRANCH_MAX_WIDTH = 220;

interface BranchScopeFilterProps {
  workspacePath: string;
  scope: BranchScope;
  /** The branch the workspace is on; none on a label, a changeset or a shelve, where "This branch" has none to follow. */
  currentBranch: string | undefined;
  onShowAll: () => void;
  onShowCurrent: () => void;
  onPick: (name: string) => void;
}

/**
 * The Changesets view's branch filter: every branch, the workspace's own, or any branch picked from the list the
 * branch switcher shows, in its order (`branchSwitcherGroups`). That list is the repository's every branch, read once
 * and shared with the switcher, the pickers and the palette (`useBranches`); it is asked for only once the popover opens.
 */
export function BranchScopeFilter({ workspacePath, scope, currentBranch, onShowAll, onShowCurrent, onPick }: BranchScopeFilterProps) {
  const [open, setOpen] = useState(false);
  const choose = (choice: () => void) => () => {
    setOpen(false);
    choice();
  };
  const options = [
    { id: 'all', label: 'All branches', checked: scope.kind === 'all', onSelect: choose(onShowAll) },
    ...(currentBranch
      ? [{ id: 'current', label: 'This branch', tip: `The branch the workspace is on: ${currentBranch}`, checked: scope.kind === 'current', onSelect: choose(onShowCurrent) }]
      : []),
  ];

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={360}
      trigger={
        <MenuChip icon={<GitBranch size={13} />} active={scope.kind !== 'all'}>
          {scope.kind === 'all' ? 'All branches' : scope.kind === 'current' ? 'This branch' : <PathLabel path={scope.name} fitContent maxWidth={PICKED_BRANCH_MAX_WIDTH} />}
        </MenuChip>
      }
    >
      <FilterOptions kind="radio" options={options} />
      <BranchList workspacePath={workspacePath} currentBranch={currentBranch} onPick={(name) => choose(() => onPick(name))()} />
    </FilterPopover>
  );
}

function BranchList({ workspacePath, currentBranch, onPick }: { workspacePath: string; currentBranch: string | undefined; onPick: (name: string) => void }) {
  const { data: branches } = useBranches();
  const recentGuids = useRecentBranchGuids(workspacePath);
  const groups = useMemo(() => branches && branchSwitcherGroups(branches, recentGuids), [branches, recentGuids]);
  if (!groups) return <CenteredSpinner />;
  return <BranchSearchList groups={groups} currentBranch={currentBranch} onPick={(branch) => onPick(branch.name)} />;
}
