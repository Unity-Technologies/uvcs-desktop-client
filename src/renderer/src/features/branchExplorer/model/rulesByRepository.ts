import type { ExplorerRule } from './explorerRules';

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

/**
 * The repositories whose rules are turned off: kept as they are, applied nowhere until turned back on. Only the
 * ones off are named, so a repository starts with its rules on.
 */
export type RulesOff = Readonly<Record<string, true>>;

export function withRulesOn(rulesOff: RulesOff, repository: string, on: boolean): RulesOff {
  if (!on) return { ...rulesOff, [repository]: true };
  const { [repository]: _off, ...rest } = rulesOff;
  return rest;
}

export function rulesOnIn(rulesOff: RulesOff, repository: string | undefined): boolean {
  return repository === undefined || rulesOff[repository] !== true;
}

/** The rules the graph applies: the repository's own, or none while they're turned off. */
export function appliedRulesOf(rulesByRepository: RulesByRepository, rulesOff: RulesOff, repository: string | undefined): readonly ExplorerRule[] {
  return rulesOnIn(rulesOff, repository) ? rulesOf(rulesByRepository, repository) : NO_RULES;
}
