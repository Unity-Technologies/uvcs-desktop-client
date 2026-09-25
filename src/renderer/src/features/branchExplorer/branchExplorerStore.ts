import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { navigation } from '../../app/navigation/navigationStore';
import type { BranchChoice } from './model/branchChoice';
import type { DateRangeId } from './model/dateRanges';
import type { RevealTarget } from './model/revealTarget';

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
  /** Something to select and frame, asked for from another view; cleared once handled. */
  revealRequest: RevealTarget | null;
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
      revealRequest: null,
      set,
    }),
    {
      name: 'branch-explorer-preferences',
      partialize: ({ visibleBranches: _branches, highlightedAuthor: _author, revealRequest: _request, set: _action, ...remembered }) => remembered,
    },
  ),
);

/** Opens the Branch Explorer on a changeset, branch or label, relaxing its filters as far as it takes to show it. */
export function showInBranchExplorer(target: RevealTarget): void {
  useBranchExplorerPreferences.getState().set({ revealRequest: target });
  navigation.goToView('branchExplorer');
}
