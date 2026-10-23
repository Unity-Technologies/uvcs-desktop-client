import * as Popover from '@radix-ui/react-popover';
import { GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { PathLabel } from '../../components/PathLabel';
import { MenuChip } from '../../ui/ToggleChip';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { BranchSearchList } from '../branches/BranchSearchList';
import { branchesRead } from '../branches/branchSearchRows';
import { branchSwitcherGroups } from '../branches/branchSwitcherGroups';
import { useBranches } from '../branches/useBranches';
import styles from './FilesBranchPicker.module.css';

/** Past this a long branch name drops parent branches from its middle, keeping its leaf. */
const NAME_MAX_WIDTH = 240;

/**
 * The branch whose files the Files view shows, as a code host's branch selector: the main branch first, then the
 * newest (`branchSwitcherGroups`). Picking one shows its latest tree; nothing on disk changes.
 */
export function FilesBranchPicker({ shown, onPick }: { shown: Branch; onPick: (branch: Branch) => void }) {
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus(open);
  const branchesQuery = useBranches();
  const groups = useMemo(() => branchSwitcherGroups(branchesQuery.data ?? [], []), [branchesQuery.data]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <MenuChip icon={<GitBranch size={13} />} data-tip="The branch whose files show" aria-label={`Branch ${shown.name}`}>
          <PathLabel path={shown.name} fitContent maxWidth={NAME_MAX_WIDTH} tooltip={false} />
        </MenuChip>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="start" sideOffset={6} {...returnFocus}>
          <BranchSearchList
            groups={groups}
            currentBranch={shown.name}
            read={branchesRead(branchesQuery)}
            placeholder="Show the files of a branch…"
            onPick={(branch) => {
              setOpen(false);
              onPick(branch);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
