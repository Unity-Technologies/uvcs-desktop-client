import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/Button';
import { BranchChecklist } from './BranchChecklist';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import viewStyles from './BranchExplorerView.module.css';
import styles from './BranchFilterPopover.module.css';

/** The Branches pill: which kinds of branches to show, and a checklist to pick them one by one. */
export function BranchFilterPopover({ branches }: { branches: readonly string[] }) {
  const preferences = useBranchExplorerPreferences();
  const { set, visibleBranches } = preferences;
  const activeCount = [preferences.onlyRelatedToCurrent, preferences.hideMergedBranches, preferences.showHiddenBranches, visibleBranches !== null].filter(Boolean).length;

  const options = [
    { id: 'related', label: 'Only branches related to mine', checked: preferences.onlyRelatedToCurrent, toggle: () => set({ onlyRelatedToCurrent: !preferences.onlyRelatedToCurrent }) },
    { id: 'merged', label: 'Hide merged branches', checked: preferences.hideMergedBranches, toggle: () => set({ hideMergedBranches: !preferences.hideMergedBranches }) },
    { id: 'hidden', label: 'Show hidden branches', checked: preferences.showHiddenBranches, toggle: () => set({ showHiddenBranches: !preferences.showHiddenBranches }) },
  ];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button size="small" className={viewStyles.filterPill} data-active={activeCount > 0}>
          Branches
          {activeCount > 0 && <span className={viewStyles.filterValue}>{activeCount}</span>}
          <ChevronDown size={12} className={viewStyles.filterChevron} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="start" sideOffset={4}>
          <div className={styles.options}>
            {options.map((option) => (
              <button key={option.id} type="button" role="menuitemcheckbox" aria-checked={option.checked} className={styles.option} onClick={option.toggle}>
                <span className={styles.check}>{option.checked && <Check size={13} />}</span>
                {option.label}
              </button>
            ))}
          </div>
          <BranchChecklist branches={branches} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
