import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BranchChoice } from './model/branchChoice';
import type { DateRangeId } from './model/dateRanges';

interface BranchExplorerPreferences {
  dateRange: DateRangeId;
  hideMergedBranches: boolean;
  showHiddenBranches: boolean;
  /** Show only the branches related to the workspace branch. */
  onlyRelatedToCurrent: boolean;
  /** The branches picked in the Branches filter. Not remembered: branches differ between repositories. */
  visibleBranches: BranchChoice;
  /** Fade out changesets by anyone else. Not remembered: authors differ between repositories. */
  highlightedAuthor: string | null;
  /** Only the changesets that shape the diagram; the linear runs between them collapse into "+N" nodes. */
  structureOnly: boolean;
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
      visibleBranches: null,
      highlightedAuthor: null,
      structureOnly: false,
      showComments: true,
      showAvatars: true,
      detailsOpen: true,
      set,
    }),
    {
      name: 'branch-explorer-preferences',
      partialize: ({ visibleBranches: _branches, highlightedAuthor: _author, set: _action, ...remembered }) => remembered,
    },
  ),
);
