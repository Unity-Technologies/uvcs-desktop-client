import type { RuleMatch, RuleQuery } from '@shared/domain/branchExplorer';
import { ruleQueryKey, ruleQueryOf, type ExplorerRule } from './explorerRules';

/** The server's answers to `ruleQueries`, by `ruleQueryKey`. */
export type RuleMatches = ReadonlyMap<string, RuleMatch>;

export function ruleMatchesOf(queries: readonly RuleQuery[], answers: readonly RuleMatch[]): RuleMatches {
  return new Map(queries.map((query, index) => [ruleQueryKey(query), answers[index] ?? { matched: [] }]));
}

/**
 * What `rule` matched, or null when it doesn't take part: disabled, without a condition, refused by `cm`, or not
 * answered yet (the rules apply once their answers arrive, never half of them).
 */
export function matchedBy(rule: ExplorerRule, matches: RuleMatches): ReadonlySet<string> | null {
  const query = ruleQueryOf(rule);
  const match = query ? matches.get(ruleQueryKey(query)) : undefined;
  return match && 'matched' in match ? new Set(match.matched) : null;
}

/** Why `cm` refused the rule's condition, to show on its row; null when it didn't. */
export function ruleError(rule: ExplorerRule, matches: RuleMatches): string | null {
  const query = ruleQueryOf(rule);
  const match = query ? matches.get(ruleQueryKey(query)) : undefined;
  return match && 'error' in match ? match.error : null;
}
