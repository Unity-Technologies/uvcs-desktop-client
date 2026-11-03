import type { RuleMatch, RuleQuery } from '@shared/domain/branchExplorer';
import { ruleQueryKey, ruleQueryOf, type ExplorerRule } from './explorerRules';

/** The server's answers to `ruleQueries`, by `ruleQueryKey`. */
export type RuleMatches = ReadonlyMap<string, RuleMatch>;

const NO_MATCHES: RuleMatches = new Map();

export function ruleMatchesOf(queries: readonly RuleQuery[], answers: readonly RuleMatch[]): RuleMatches {
  return new Map(queries.map((query, index) => [ruleQueryKey(query), answers[index] ?? { matched: [] }]));
}

/**
 * What `rule` matched, or null when it doesn't take part: disabled, without a condition, refused by `cm`, or not
 * answered yet (the rules apply once their answers arrive, never half of them).
 */
export function matchedBy(rule: ExplorerRule, matches: RuleMatches): ReadonlySet<string> | null {
  const match = answerTo(rule, matches);
  return match && 'matched' in match ? new Set(match.matched) : null;
}

/** Why `cm` refused the rule's condition, to show on its row; null when it didn't. */
export function ruleError(rule: ExplorerRule, matches: RuleMatches): string | null {
  const match = answerTo(rule, matches);
  return match && 'error' in match ? match.error : null;
}

/** The server's answer to the rule's question; undefined when it asks none, or before the answer arrives. */
function answerTo(rule: ExplorerRule, matches: RuleMatches): RuleMatch | undefined {
  const query = ruleQueryOf(rule);
  return query ? matches.get(ruleQueryKey(query)) : undefined;
}

/**
 * The answers that apply: none once no rule asks a question (the query then keeps its last answer, which must not
 * color or hide anything) or before the first answer arrives.
 */
export function shownRuleMatches(questionCount: number, answered: RuleMatches | undefined): RuleMatches {
  return questionCount > 0 && answered ? answered : NO_MATCHES;
}
