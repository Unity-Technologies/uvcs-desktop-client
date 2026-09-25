import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateRangeId } from './model/dateRanges';

interface BranchExplorerPreferences {
  dateRange: DateRangeId;
  hideMergedBranches: boolean;
  showHiddenBranches: boolean;
  /** Show only the branches related to the workspace branch. */
  onlyRelatedToCurrent: boolean;
  /** Fade out changesets by anyone else. Not remembered: authors differ between repositories. */
  highlightedAuthor: string | null;
  showComments: boolean;
  showAvatars: boolean;
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
      highlightedAuthor: null,
      showComments: true,
      showAvatars: true,
      detailsOpen: true,
      set,
    }),
    {
      name: 'branch-explorer-preferences',
      partialize: ({ highlightedAuthor: _notRemembered, set: _action, ...remembered }) => remembered,
    },
  ),
);
