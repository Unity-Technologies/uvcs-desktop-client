import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { navigation } from '../../app/navigation/navigationStore';
import { detailsHidden, useDetailsPaneStore } from '../../components/detailsPaneStore';
import { EVERYONE, rememberedPick, type PeoplePick } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { detailsOpenOf, migrateBranchExplorerPreferences } from './branchExplorerMigration';
import type { BranchChoice } from './model/branchChoice';
import type { RevealTarget } from './model/revealTarget';

/** The key of the Branch Explorer's details (`ListWithDetails`, `DetailsToggleButton`). */
export const BRANCH_EXPLORER_DETAILS_KEY = 'branchExplorer';

export interface BranchExplorerPreferences {
  dateRange: SincePreset;
  hideMergedBranches: boolean;
  showHiddenBranches: boolean;
  /** Show only the branches related to the workspace branch. */
  onlyRelatedToCurrent: boolean;
  /** The branches picked in the Branches filter. Not remembered: branches differ between repositories. */
  visibleBranches: BranchChoice;
  /** Fade out changesets by anyone else. Only Mine is remembered: people differ between repositories. */
  people: PeoplePick;
  /** Only the changesets that shape the diagram; the linear runs between them collapse into "+N" nodes. */
  structureOnly: boolean;
  showComments: boolean;
  showAvatars: boolean;
  /** Something to select and frame, asked for from another view; cleared once handled. */
  revealRequest: RevealTarget | null;
  set: (changes: Partial<Omit<BranchExplorerPreferences, 'set'>>) => void;
}

export const useBranchExplorerPreferences = create<BranchExplorerPreferences>()(
  persist(
    (set) => ({
      dateRange: 'lastMonth',
      hideMergedBranches: false,
      showHiddenBranches: false,
      onlyRelatedToCurrent: false,
      visibleBranches: null,
      people: EVERYONE,
      structureOnly: false,
      showComments: true,
      showAvatars: true,
      revealRequest: null,
      set,
    }),
    {
      name: 'branch-explorer-preferences',
      version: 2,
      partialize: ({ visibleBranches: _branches, revealRequest: _request, set: _action, people, ...remembered }) => ({ ...remembered, people: rememberedPick(people) }),
      migrate: (persisted, version) => {
        // The details' own store keeps whether they're hidden now: a user who had closed them keeps them closed.
        if (!detailsOpenOf(persisted) && !detailsHidden(useDetailsPaneStore.getState(), BRANCH_EXPLORER_DETAILS_KEY)) {
          useDetailsPaneStore.getState().toggleHidden(BRANCH_EXPLORER_DETAILS_KEY);
        }
        return migrateBranchExplorerPreferences(persisted, version) as BranchExplorerPreferences;
      },
    },
  ),
);

/** Opens the Branch Explorer on a changeset, branch or label, relaxing its filters as far as it takes to show it. */
export function showInBranchExplorer(target: RevealTarget): void {
  useBranchExplorerPreferences.getState().set({ revealRequest: target });
  navigation.goToView('branchExplorer');
}
