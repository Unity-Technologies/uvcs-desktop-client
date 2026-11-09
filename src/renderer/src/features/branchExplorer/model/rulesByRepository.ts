import type { ExplorerRule } from './explorerRules';
import { isOnIn, type OffByRepository } from './offByRepository';

/** The advanced rules, by repository: a condition names that repository's branches and owners. */
export type RulesByRepository = Readonly<Record<string, ExplorerRule[]>>;

const NO_RULES: readonly ExplorerRule[] = [];

export function withRules(rulesByRepository: RulesByRepository, repository: string, rules: ExplorerRule[]): RulesByRepository {
  return { ...rulesByRepository, [repository]: rules };
}

/** The repository's rules; always the same empty list when it has none, so a store selector stays stable. */
export function rulesOf(rulesByRepository: RulesByRepository, repository: string | undefined): readonly ExplorerRule[] {
  return (repository === undefined ? undefined : rulesByRepository[repository]) ?? NO_RULES;
}

/** The rules the graph applies: the repository's own, or none while they're turned off. */
export function appliedRulesOf(rulesByRepository: RulesByRepository, rulesOff: OffByRepository, repository: string | undefined): readonly ExplorerRule[] {
  return isOnIn(rulesOff, repository) ? rulesOf(rulesByRepository, repository) : NO_RULES;
}
