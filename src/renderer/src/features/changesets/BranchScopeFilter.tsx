import { workspacePathOf, type Place } from '@shared/domain/place';
import { GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PathLabel } from '../../components/PathLabel';
import { FilterOptions } from '../../ui/FilterOptions';
import { FilterPopover } from '../../ui/FilterPopover';
import { MenuChip } from '../../ui/ToggleChip';
import { BranchSearchList } from '../branches/BranchSearchList';
import { branchesRead } from '../branches/branchSearchRows';
import { branchSwitcherGroups } from '../branches/branchSwitcherGroups';
import { useRecentBranchGuids } from '../branches/recentBranches';
import { useBranches } from '../branches/useBranches';
import type { BranchScope } from './changesetFilters';

/** A branch picked by name, fitted to the chip: long nested names keep their own name whole (`PathLabel`). */
const PICKED_BRANCH_MAX_WIDTH = 220;

interface BranchScopeFilterProps {
  place: Place;
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
export function BranchScopeFilter({ place, scope, currentBranch, onShowAll, onShowCurrent, onPick }: BranchScopeFilterProps) {
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
        <MenuChip icon={<GitBranch size={13} />} active={scope.kind !== 'all'} aria-label={chipName(scope)}>
          {scope.kind === 'all' ? 'All branches' : scope.kind === 'current' ? 'This branch' : <PathLabel path={scope.name} fitContent maxWidth={PICKED_BRANCH_MAX_WIDTH} />}
        </MenuChip>
      }
    >
      <FilterOptions label="Branches" kind="radio" options={options} />
      <BranchList place={place} currentBranch={currentBranch} onPick={(name) => choose(() => onPick(name))()} />
    </FilterPopover>
  );
}

/** The chip's accessible name, the whole branch included: the chip shows "This branch", or a path fitted to it. */
function chipName(scope: BranchScope): string {
  if (scope.kind === 'all') return 'Branch: All branches';
  return scope.kind === 'current' ? `Branch: This branch, ${scope.name}` : `Branch: ${scope.name}`;
}

function BranchList({ place, currentBranch, onPick }: { place: Place; currentBranch: string | undefined; onPick: (name: string) => void }) {
  const branchesQuery = useBranches();
  const recentGuids = useRecentBranchGuids(workspacePathOf(place));
  const groups = useMemo(() => branchSwitcherGroups(branchesQuery.data ?? [], recentGuids), [branchesQuery.data, recentGuids]);
  return <BranchSearchList groups={groups} currentBranch={currentBranch} onPick={(branch) => onPick(branch.name)} read={branchesRead(branchesQuery)} />;
}
