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
