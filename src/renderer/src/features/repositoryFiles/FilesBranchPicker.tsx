import { GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { PathLabel } from '../../components/PathLabel';
import { FilterPopover } from '../../ui/FilterPopover';
import { MenuChip } from '../../ui/ToggleChip';
import { BranchSearchList } from '../branches/BranchSearchList';
import { branchesRead } from '../branches/branchSearchRows';
import { branchSwitcherGroups } from '../branches/branchSwitcherGroups';
import { useBranches } from '../branches/useBranches';

/** Past this a long branch name drops parent branches from its middle, keeping its leaf. */
const NAME_MAX_WIDTH = 240;

/**
 * The branch whose files the Files view shows, as a code host's branch selector, among the filters: the main branch
 * first, then the newest (`branchSwitcherGroups`). Picking one shows its latest tree; nothing on disk changes. `shown`
 * none: no branch shows yet (the main branch renamed), and the chip asks for one.
 */
export function FilesBranchPicker({ shown, onPick }: { shown: string | null; onPick: (branch: Branch) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={460}
      trigger={
        <MenuChip icon={<GitBranch size={13} />} data-tip="The branch whose files show" aria-label={`Branch: ${shown ?? 'none'}`}>
          {shown ? <PathLabel path={shown} fitContent maxWidth={NAME_MAX_WIDTH} tooltip={false} /> : 'Pick a branch'}
        </MenuChip>
      }
    >
      <BranchList
        shown={shown}
        onPick={(branch) => {
          setOpen(false);
          onPick(branch);
        }}
      />
    </FilterPopover>
  );
}

/** Every branch, read only once the chip opens: a big repository holds thousands, and showing one needs only it. */
function BranchList({ shown, onPick }: { shown: string | null; onPick: (branch: Branch) => void }) {
  const branchesQuery = useBranches();
  const groups = useMemo(() => branchSwitcherGroups(branchesQuery.data ?? [], []), [branchesQuery.data]);
  return (
    <BranchSearchList
      groups={groups}
      currentBranch={shown ?? undefined}
      read={branchesRead(branchesQuery)}
      placeholder="Show the files of a branch…"
      onPick={onPick}
    />
  );
}
