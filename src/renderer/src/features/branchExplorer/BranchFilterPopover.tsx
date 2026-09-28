import { Check, GitBranch } from 'lucide-react';
import { FilterPopover } from '../../ui/FilterPopover';
import { MenuChip } from '../../ui/ToggleChip';
import { BranchChecklist } from './BranchChecklist';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import styles from './BranchFilterPopover.module.css';

/** The Branches chip: which kinds of branches to show, and a checklist to pick them one by one. */
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
    <FilterPopover
      trigger={
        <MenuChip icon={<GitBranch size={13} />} active={activeCount > 0}>
          {activeCount > 0 ? `Branches · ${activeCount}` : 'Branches'}
        </MenuChip>
      }
    >
      <div className={styles.options}>
        {options.map((option) => (
          <button key={option.id} type="button" role="menuitemcheckbox" aria-checked={option.checked} className={styles.option} onClick={option.toggle}>
            <span className={styles.check}>{option.checked && <Check size={13} />}</span>
            {option.label}
          </button>
        ))}
      </div>
      <BranchChecklist branches={branches} />
    </FilterPopover>
  );
}
