import type { BranchPins, ExplorerRule, UserColors } from '@shared/domain/branchExplorerSettings';
import type { RepositorySettings } from '@shared/domain/scopedSettings';
import { NO_PINS } from './branchRows';
import { DEFAULT_USER_COLORS } from './userColors';

// What the Branch Explorer applies from a repository's settings (`RepositorySettings`). Each answers the same empty
// list or object while the repository has none, so a selector built on them stays stable.

const NO_RULES: readonly ExplorerRule[] = [];

/** The repository's advanced filters and formats, on or off. */
export function explorerRulesOf(settings: RepositorySettings): readonly ExplorerRule[] {
  return settings.explorerRules ?? NO_RULES;
}

/** The rules the graph applies: the repository's own, or none while they're turned off. */
export function appliedExplorerRulesOf(settings: RepositorySettings): readonly ExplorerRule[] {
  return settings.explorerRulesOff ? NO_RULES : explorerRulesOf(settings);
}

/** The branches moved in the repository. */
export function branchPinsOf(settings: RepositorySettings): BranchPins {
  return settings.branchPins ?? NO_PINS;
}

/** The changeset colors the graph applies in the repository: none while they're turned off there, keeping them. */
export function appliedUserColorsOf(colors: UserColors, settings: RepositorySettings): UserColors {
  return settings.changesetColorsOff ? DEFAULT_USER_COLORS : colors;
}
