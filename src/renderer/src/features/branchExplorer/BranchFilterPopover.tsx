import { GitBranch } from 'lucide-react';
import { FilterOptions } from '../../ui/FilterOptions';
import { FilterPopover } from '../../ui/FilterPopover';
import { MenuChip } from '../../ui/ToggleChip';
import { BranchChecklist } from './BranchChecklist';
import { useBranchExplorerPreferences } from './branchExplorerStore';

/** The Branches chip: which kinds of branches to show, and a checklist to pick them one by one. */
export function BranchFilterPopover({ branches }: { branches: readonly string[] }) {
  const preferences = useBranchExplorerPreferences();
  const { set, visibleBranches } = preferences;
  const activeCount = [preferences.onlyRelatedToCurrent, preferences.hideMergedBranches, preferences.showHiddenBranches, visibleBranches !== null].filter(Boolean).length;

  const options = [
    { id: 'related', label: 'Only branches related to mine', checked: preferences.onlyRelatedToCurrent, onSelect: () => set({ onlyRelatedToCurrent: !preferences.onlyRelatedToCurrent }) },
    { id: 'merged', label: 'Hide merged branches', checked: preferences.hideMergedBranches, onSelect: () => set({ hideMergedBranches: !preferences.hideMergedBranches }) },
    { id: 'hidden', label: 'Show hidden branches', checked: preferences.showHiddenBranches, onSelect: () => set({ showHiddenBranches: !preferences.showHiddenBranches }) },
  ];

  return (
    <FilterPopover
      trigger={
        <MenuChip icon={<GitBranch size={13} />} active={activeCount > 0}>
          {activeCount > 0 ? `Branches · ${activeCount}` : 'Branches'}
        </MenuChip>
      }
    >
      <FilterOptions options={options} />
      <BranchChecklist branches={branches} />
    </FilterPopover>
  );
}
