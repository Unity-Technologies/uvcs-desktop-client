import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateRangeId } from './model/dateRanges';

interface BranchExplorerPreferences {
  dateRange: DateRangeId;
  hideMergedBranches: boolean;
  showHiddenBranches: boolean;
  /** Show only the branches related to the workspace branch. */
  onlyRelatedToCurrent: boolean;
  detailsOpen: boolean;
  set: (changes: Partial<Omit<BranchExplorerPreferences, 'set'>>) => void;
}

export const useBranchExplorerPreferences = create<BranchExplorerPreferences>()(
  persist(
    (set) => ({
      dateRange: 'month',
      hideMergedBranches: false,
      showHiddenBranches: false,
      onlyRelatedToCurrent: false,
      detailsOpen: true,
      set,
    }),
    { name: 'branch-explorer-preferences' },
  ),
);
