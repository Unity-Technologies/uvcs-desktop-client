import { hasCondition, isFormatRule, type ExplorerRule, type ExplorerRuleKind, type RuleExpansion } from './explorerRules';

/**
 * The decisions of the display options' "Advanced filters & format" tab (`ExplorerRulesTab`) and its rule editor
 * (`ExplorerRuleEditor`): what each kind is called, what the Add menu offers, how a row reads, how the list changes,
 * and when an edited rule can be saved.
 */

export const RULE_KIND_LABELS: Record<ExplorerRuleKind, string> = {
  include: 'Inclusion',
  exclude: 'Exclusion',
  branchFormat: 'Branch format',
  changesetFormat: 'Changeset format',
  labelFormat: 'Label format',
  pendingMerges: 'Branches with pending merges',
  currentBranch: 'Workspace branch',
};

/** The Add menu, one group per separator: filters, formats with a condition, then the built-in formats. */
export const ADD_RULE_GROUPS: readonly (readonly ExplorerRuleKind[])[] = [
  ['include', 'exclude'],
  ['branchFormat', 'changesetFormat', 'labelFormat'],
  ['pendingMerges', 'currentBranch'],
];

export const EXPANSION_OPTIONS: readonly { option: keyof RuleExpansion; label: string }[] = [
  { option: 'children', label: 'Child branches' },
  { option: 'parent', label: 'Parent branch' },
  { option: 'mergeSources', label: 'Branches merged into them' },
  { option: 'mergeDestinations', label: 'Branches they were merged into' },
];

const CONDITION_EXAMPLES: Partial<Record<ExplorerRuleKind, string>> = {
  include: "Which branches to show, as in a find query: owner = 'me'",
  exclude: "Which branches to hide, as in a find query: name like '%experiment%'",
  branchFormat: "Which branches to color, as in a find query: date >= '1 weeks ago'",
  changesetFormat: "Which changesets to color, as in a find query: owner = 'me'",
  labelFormat: "Which labels to color, as in a find query: name like 'v%'",
};

/** The condition field's hint, or null for a built-in format, which has no condition. */
export function conditionHint(kind: ExplorerRuleKind): string | null {
  return CONDITION_EXAMPLES[kind] ?? null;
}

export interface RuleSections {
  /** Inclusions and exclusions: their order changes nothing. */
  filters: ExplorerRule[];
  /** Formats, in the order they apply: a later one colors over an earlier one. */
  formats: ExplorerRule[];
}

export function ruleSections(rules: readonly ExplorerRule[]): RuleSections {
  return { filters: rules.filter((rule) => !isFormatRule(rule)), formats: rules.filter(isFormatRule) };
}

/**
 * A row's second line: what the rule matches, and what an inclusion or exclusion takes with it. A built-in format
 * titled by its kind has none: its title already names what it colors.
 */
export function ruleRowDetail(rule: ExplorerRule): string | null {
  if (!hasCondition(rule.kind) && ruleRowTitle(rule) === RULE_KIND_LABELS[rule.kind]) return null;
  const matches = hasCondition(rule.kind) ? rule.condition.trim() || 'No condition yet' : RULE_KIND_LABELS[rule.kind];
  const taken = EXPANSION_OPTIONS.filter(({ option }) => !isFormatRule(rule) && rule.expansion[option]).map(({ label }) => label.toLowerCase());
  return taken.length > 0 ? `${matches} · with ${joinWords(taken)}` : matches;
}

/** The row's first line: its description, or the kind's name when it has none. */
export function ruleRowTitle(rule: ExplorerRule): string {
  return rule.description.trim() || RULE_KIND_LABELS[rule.kind];
}

function joinWords(words: string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export function addRule(rules: readonly ExplorerRule[], rule: ExplorerRule): ExplorerRule[] {
  return [...rules, rule];
}

export function replaceRule(rules: readonly ExplorerRule[], rule: ExplorerRule): ExplorerRule[] {
  return rules.map((existing) => (existing.id === rule.id ? rule : existing));
}

export function removeRule(rules: readonly ExplorerRule[], id: string): ExplorerRule[] {
  return rules.filter((rule) => rule.id !== id);
}

/**
 * The rules with `id` swapped with the nearest format before (-1) or after (+1) it. Only formats move: their order
 * decides which color wins; the filters' order decides nothing. Unchanged when there's nowhere to go.
 */
export function moveRule(rules: readonly ExplorerRule[], id: string, offset: -1 | 1): ExplorerRule[] {
  const target = neighborIndex(rules, id, offset);
  const index = rules.findIndex((rule) => rule.id === id);
  if (target === null) return [...rules];
  const moved = [...rules];
  [moved[index], moved[target]] = [moved[target]!, moved[index]!];
  return moved;
}

export function canMoveRule(rules: readonly ExplorerRule[], id: string, offset: -1 | 1): boolean {
  return neighborIndex(rules, id, offset) !== null;
}

function neighborIndex(rules: readonly ExplorerRule[], id: string, offset: -1 | 1): number | null {
  const index = rules.findIndex((rule) => rule.id === id);
  if (index < 0 || !isFormatRule(rules[index]!)) return null;
  for (let other = index + offset; other >= 0 && other < rules.length; other += offset) {
    if (isFormatRule(rules[other]!)) return other;
  }
  return null;
}

/** What stops an edited rule from being saved, or null when it can be. */
export function ruleDraftProblem(draft: ExplorerRule): string | null {
  if (hasCondition(draft.kind) && !draft.condition.trim()) return 'Write which ones it matches';
  return null;
}

/** The editor's title: "New inclusion", "Edit label format". */
export function ruleEditorTitle(kind: ExplorerRuleKind, isNew: boolean): string {
  const name = RULE_KIND_LABELS[kind];
  return `${isNew ? 'New' : 'Edit'} ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}
