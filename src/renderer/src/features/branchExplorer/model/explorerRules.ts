import type { RuleObject, RuleQuery } from '@shared/domain/branchExplorer';
import { BRANCH_HUES } from './branchHue';

/**
 * The Branch Explorer's advanced rules, applied in order. Inclusions keep only the branches they match, exclusions hide
 * the branches they match (and win over inclusions), and format rules color what they match (a later rule over an
 * earlier one). Every rule but the two built-in formats asks the server with a `cm find` condition.
 */
export type ExplorerRuleKind = 'include' | 'exclude' | 'branchFormat' | 'changesetFormat' | 'labelFormat' | 'pendingMerges' | 'currentBranch';

/** Which relatives of the branches an inclusion or exclusion matches it takes with them. */
export interface RuleExpansion {
  /** Every branch below them. */
  children: boolean;
  /** The branch each one starts from. */
  parent: boolean;
  /** The branches merged into them. */
  mergeSources: boolean;
  /** The branches they were merged into. */
  mergeDestinations: boolean;
}

export interface ExplorerRule {
  id: string;
  kind: ExplorerRuleKind;
  enabled: boolean;
  description: string;
  /** A `cm find` condition without `where` (`owner = 'me'`); empty for the built-in formats, which need none. */
  condition: string;
  /** For inclusions and exclusions only. */
  expansion: RuleExpansion;
  /** One of `BRANCH_HUES`, for format rules only. */
  hue: number | null;
}

export const NO_EXPANSION: RuleExpansion = { children: false, parent: false, mergeSources: false, mergeDestinations: false };

const QUERY_OBJECTS: Partial<Record<ExplorerRuleKind, RuleObject>> = {
  include: 'branch',
  exclude: 'branch',
  branchFormat: 'branch',
  changesetFormat: 'changeset',
  labelFormat: 'label',
};

const STARTING_RULES: Record<ExplorerRuleKind, Pick<ExplorerRule, 'description' | 'condition' | 'hue'>> = {
  include: { description: 'Main branch', condition: "name = '/main'", hue: null },
  exclude: { description: 'Experiments', condition: "name like '%experiment%'", hue: null },
  branchFormat: { description: 'Changed this month', condition: "changesets >= '1 months ago'", hue: BRANCH_HUES[1]! },
  changesetFormat: { description: 'My changesets', condition: "owner = 'me'", hue: BRANCH_HUES[0]! },
  labelFormat: { description: 'Published labels', condition: "attribute = 'publish-status' and attrvalue = 'PUBLISHED'", hue: BRANCH_HUES[4]! },
  pendingMerges: { description: 'Branches with pending merges', condition: '', hue: BRANCH_HUES[6]! },
  currentBranch: { description: 'Workspace branch', condition: '', hue: BRANCH_HUES[2]! },
};

/** A rule as it is added: enabled, with an example condition to edit. */
export function newRule(kind: ExplorerRuleKind, id: string): ExplorerRule {
  return { id, kind, enabled: true, expansion: NO_EXPANSION, ...STARTING_RULES[kind] };
}

export function isFilterRule(rule: ExplorerRule): boolean {
  return rule.kind === 'include' || rule.kind === 'exclude';
}

export function isFormatRule(rule: ExplorerRule): boolean {
  return !isFilterRule(rule);
}

/** Whether the user writes the rule's condition: the built-in formats have none. */
export function hasCondition(kind: ExplorerRuleKind): boolean {
  return QUERY_OBJECTS[kind] !== undefined;
}

/** What the server is asked for `rule`, or null when it asks nothing (disabled, built-in, or no condition yet). */
export function ruleQueryOf(rule: ExplorerRule): RuleQuery | null {
  const object = QUERY_OBJECTS[rule.kind];
  const condition = rule.condition.trim();
  return rule.enabled && object && condition ? { object, condition } : null;
}

/**
 * The queries of the rules that ask the server, each once: rules asking the same thing share one `cm find`. Sorted,
 * so the same rules in another order are one query key and load nothing new.
 */
export function ruleQueries(rules: readonly ExplorerRule[]): RuleQuery[] {
  const byKey = new Map<string, RuleQuery>();
  for (const rule of rules) {
    const query = ruleQueryOf(rule);
    if (query) byKey.set(ruleQueryKey(query), query);
  }
  return [...byKey].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, query]) => query);
}

/** Identifies a query among the answers to `ruleQueries`. */
export function ruleQueryKey(query: RuleQuery): string {
  return `${query.object}\n${query.condition}`;
}
