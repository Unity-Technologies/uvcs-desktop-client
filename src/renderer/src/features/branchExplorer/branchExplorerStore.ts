import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { BranchPins, ExplorerRule, UserColors } from '@shared/domain/branchExplorerSettings';
import { navigation } from '../../app/navigation/navigationStore';
import { updateRepositorySettings, useRepositorySettings } from '../../app/settings/useScopedSettings';
import { saveSettings, useSettings } from '../../app/settings/useSettings';
import { BRANCH_EXPLORER_KEPT_KEY } from '../../app/settings/windowKeptSettings';
import { useDetailsPaneStore } from '../../components/detailsPaneStore';
import { EVERYONE, rememberedPick, type PeoplePick } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { DEFAULT_GRAPH_VIEW_OPTIONS, graphViewOptionsOf, type GraphViewOptions } from './canvas/graphViewOptions';
import { hiddenAfterMigration, migrateBranchExplorerPreferences, rememberedPreferences } from './branchExplorerMigration';
import type { BranchChoice } from './model/branchChoice';
import { appliedExplorerRulesOf, appliedUserColorsOf, branchPinsOf, explorerRulesOf } from './model/explorerRepositorySettings';
import type { RevealTarget } from './model/revealTarget';

/** The key of the Branch Explorer's details (`ListWithDetails`, `DetailsToggleButton`). */
export const BRANCH_EXPLORER_DETAILS_KEY = 'branchExplorer';

/** The display options (`GraphViewOptions`) are remembered with the filters; a new one shows until turned off. */
export interface BranchExplorerPreferences extends GraphViewOptions {
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
  /** The Timeline over the graph (`GraphTimeline`): hidden until the user shows it, then remembered. */
  showTimeline: boolean;
  /** Something to select and frame, asked for from another view; cleared once handled. */
  revealRequest: RevealTarget | null;
  set: (changes: Partial<Omit<BranchExplorerPreferences, BranchExplorerActions>>) => void;
}

/** The store's actions, which aren't remembered. */
export type BranchExplorerActions = 'set';

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
      showTimeline: false,
      ...DEFAULT_GRAPH_VIEW_OPTIONS,
      revealRequest: null,
      set,
    }),
    {
      name: 'branch-explorer-preferences',
      version: 3,
      partialize: ({ visibleBranches: _branches, revealRequest: _request, set: _action, people, ...remembered }) => ({ ...remembered, people: rememberedPick(people) }),
      migrate: (persisted, version) => {
        // The details' own store keeps whether they're hidden now: a user who had closed them keeps them closed.
        useDetailsPaneStore.setState(({ hidden }) => ({ hidden: hiddenAfterMigration(persisted, hidden, BRANCH_EXPLORER_DETAILS_KEY) }));
        // The app's settings keep the rules, moved branches and colors now: put aside for them, which `main.tsx` hands
        // over once this store is read (`bringStoredWindowSettings`).
        const { remembered, kept } = migrateBranchExplorerPreferences(persisted, version);
        if (kept) localStorage.setItem(BRANCH_EXPLORER_KEPT_KEY, JSON.stringify(kept));
        return remembered as BranchExplorerPreferences;
      },
      merge: rememberedPreferences,
    },
  ),
);

/** Opens the Branch Explorer on a changeset, branch or label, relaxing its filters as far as it takes to show it. */
export function showInBranchExplorer(target: RevealTarget): void {
  useBranchExplorerPreferences.getState().set({ revealRequest: target });
  navigation.goToView('branchExplorer');
}

/** The advanced filters and formats of `repository` (none while it isn't known yet), the same array until they change. */
export function useExplorerRules(repository: string | undefined): readonly ExplorerRule[] {
  return explorerRulesOf(useRepositorySettings(repository));
}

/** Whether the rules of `repository` apply. */
export function useExplorerRulesOn(repository: string | undefined): boolean {
  return !useRepositorySettings(repository).explorerRulesOff;
}

/** The rules the graph applies in `repository`: none while they're turned off. */
export function useAppliedExplorerRules(repository: string | undefined): readonly ExplorerRule[] {
  return appliedExplorerRulesOf(useRepositorySettings(repository));
}

/** Whether the changeset colors apply in `repository`. */
export function useUserColorsOn(repository: string | undefined): boolean {
  return !useRepositorySettings(repository).changesetColorsOff;
}

/** The changeset colors, the same in every repository. */
export function useUserColors(): UserColors {
  return useSettings().changesetColors;
}

/** The changeset colors the graph applies in `repository`: none while they're turned off there. */
export function useAppliedUserColors(repository: string | undefined): UserColors {
  return appliedUserColorsOf(useUserColors(), useRepositorySettings(repository));
}

/** The branches moved in `repository` (none while it isn't known yet), the same array until they change. */
export function useBranchPins(repository: string | undefined): BranchPins {
  return branchPinsOf(useRepositorySettings(repository));
}

export function setExplorerRules(repository: string, rules: ExplorerRule[]): void {
  void updateRepositorySettings(repository, { explorerRules: rules });
}

export function setExplorerRulesOn(repository: string, on: boolean): void {
  void updateRepositorySettings(repository, { explorerRulesOff: !on });
}

export function setUserColors(colors: UserColors): void {
  void saveSettings({ changesetColors: colors });
}

export function setUserColorsOn(repository: string, on: boolean): void {
  void updateRepositorySettings(repository, { changesetColorsOff: !on });
}

export function setBranchPins(repository: string, pins: BranchPins): void {
  void updateRepositorySettings(repository, { branchPins: [...pins] });
}

/** The display options alone, the same object until one of them changes. */
export function useGraphViewOptions(): GraphViewOptions {
  return useBranchExplorerPreferences(useShallow(graphViewOptionsOf));
}
