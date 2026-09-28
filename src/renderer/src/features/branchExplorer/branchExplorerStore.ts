import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { navigation } from '../../app/navigation/navigationStore';
import { EVERYONE, rememberedPick, type PeoplePick } from '../../lib/peopleFilter';
import { sincePresetOf, type SincePreset } from '../../lib/sincePresets';
import type { BranchChoice } from './model/branchChoice';
import type { RevealTarget } from './model/revealTarget';

interface BranchExplorerPreferences {
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
  detailsOpen: boolean;
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
      detailsOpen: true,
      revealRequest: null,
      set,
    }),
    {
      name: 'branch-explorer-preferences',
      version: 1,
      partialize: ({ visibleBranches: _branches, revealRequest: _request, set: _action, people, ...remembered }) => ({ ...remembered, people: rememberedPick(people) }),
      // Before every view shared the time presets, the Branch Explorer had date ranges of its own.
      migrate: (persisted) => {
        const old = (persisted ?? {}) as Partial<BranchExplorerPreferences>;
        return { ...old, dateRange: sincePresetOf(old.dateRange) ?? 'lastMonth', people: EVERYONE } as BranchExplorerPreferences;
      },
    },
  ),
);

/** Opens the Branch Explorer on a changeset, branch or label, relaxing its filters as far as it takes to show it. */
export function showInBranchExplorer(target: RevealTarget): void {
  useBranchExplorerPreferences.getState().set({ revealRequest: target });
  navigation.goToView('branchExplorer');
}
