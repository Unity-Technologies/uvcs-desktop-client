import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { navigation } from '../../app/navigation/navigationStore';
import { useDetailsPaneStore } from '../../components/detailsPaneStore';
import { EVERYONE, rememberedPick, type PeoplePick } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { DEFAULT_GRAPH_VIEW_OPTIONS, graphViewOptionsOf, type GraphViewOptions } from './canvas/graphViewOptions';
import { hiddenAfterMigration, migrateBranchExplorerPreferences, rememberedPreferences } from './branchExplorerMigration';
import type { BranchChoice } from './model/branchChoice';
import type { ExplorerRule } from './model/explorerRules';
import type { RevealTarget } from './model/revealTarget';
import { isOnIn, withOnIn, type OffByRepository } from './model/offByRepository';
import { appliedRulesOf, rulesOf, withRules, type RulesByRepository } from './model/rulesByRepository';
import { DEFAULT_USER_COLORS, type UserColors } from './model/userColors';

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
  /**
   * The advanced filters and formats (`ExplorerRule`) of each repository, by its spec: their conditions name that
   * repository's branches and people, so another one starts with none.
   */
  rulesByRepository: RulesByRepository;
  /** The repositories whose rules are turned off (`withOnIn`). */
  rulesOff: OffByRepository;
  /** The changeset colors by user, in every repository. */
  userColors: UserColors;
  /** Something to select and frame, asked for from another view; cleared once handled. */
  revealRequest: RevealTarget | null;
  set: (changes: Partial<Omit<BranchExplorerPreferences, BranchExplorerActions>>) => void;
  setRules: (repository: string, rules: ExplorerRule[]) => void;
  setRulesOn: (repository: string, on: boolean) => void;
}

/** The store's actions, which aren't remembered. */
export type BranchExplorerActions = 'set' | 'setRules' | 'setRulesOn';

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
      ...DEFAULT_GRAPH_VIEW_OPTIONS,
      rulesByRepository: {},
      rulesOff: {},
      userColors: DEFAULT_USER_COLORS,
      revealRequest: null,
      set,
      setRules: (repository, rules) => set(({ rulesByRepository }) => ({ rulesByRepository: withRules(rulesByRepository, repository, rules) })),
      setRulesOn: (repository, on) => set(({ rulesOff }) => ({ rulesOff: withOnIn(rulesOff, repository, on) })),
    }),
    {
      name: 'branch-explorer-preferences',
      version: 2,
      partialize: ({ visibleBranches: _branches, revealRequest: _request, set: _action, setRules: _setRules, setRulesOn: _setRulesOn, people, ...remembered }) => ({ ...remembered, people: rememberedPick(people) }),
      migrate: (persisted, version) => {
        // The details' own store keeps whether they're hidden now: a user who had closed them keeps them closed.
        useDetailsPaneStore.setState(({ hidden }) => ({ hidden: hiddenAfterMigration(persisted, hidden, BRANCH_EXPLORER_DETAILS_KEY) }));
        return migrateBranchExplorerPreferences(persisted, version) as BranchExplorerPreferences;
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
  return useBranchExplorerPreferences((state) => rulesOf(state.rulesByRepository, repository));
}

/** Whether the rules of `repository` apply. */
export function useExplorerRulesOn(repository: string | undefined): boolean {
  return useBranchExplorerPreferences((state) => isOnIn(state.rulesOff, repository));
}

/** The rules the graph applies in `repository`: none while they're turned off. */
export function useAppliedExplorerRules(repository: string | undefined): readonly ExplorerRule[] {
  return useBranchExplorerPreferences((state) => appliedRulesOf(state.rulesByRepository, state.rulesOff, repository));
}

/** The display options alone, the same object until one of them changes. */
export function useGraphViewOptions(): GraphViewOptions {
  return useBranchExplorerPreferences(useShallow(graphViewOptionsOf));
}
