import { describe, expect, it } from 'vitest';
import type { BranchExplorerData, RuleMatch } from '@shared/domain/branchExplorer';
import { newRule, ruleQueries, type ExplorerRule, type RuleExpansion } from './explorerRules';
import { branch, changeset, merge } from './graphFixtures';
import { branchesKeptByRules } from './ruleFilter';
import { ruleMatchesOf, ruleError, type RuleMatches } from './ruleMatches';

/**
 * /main:      0 ─────────── 4 ─ 6       (6 merges 5)
 * /main/a:    └ 1 ──── 5 ──────┘        (5 merges 2)
 * /main/a/x:     └ 2 ─┘
 * /main/b:    └ 3
 */
function family(): BranchExplorerData {
  return {
    branches: [branch('/main', '', 6), branch('/main/a', '/main', 5), branch('/main/a/x', '/main/a', 2), branch('/main/b', '/main', 3)],
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main/a', 0),
      changeset(2, '/main/a/x', 1),
      changeset(3, '/main/b', 0),
      changeset(4, '/main', 0),
      changeset(5, '/main/a', 1),
      changeset(6, '/main', 4),
    ],
    mergeLinks: [merge(2, 5), merge(5, 6)],
    labels: [],
  };
}

const ALL_EXPANSION: RuleExpansion = { children: false, parent: false, mergeSources: false, mergeDestinations: false };

let nextId = 0;
function rule(kind: 'include' | 'exclude', condition: string, expansion: Partial<RuleExpansion> = {}): ExplorerRule {
  return { ...newRule(kind, `r${nextId++}`), condition, expansion: { ...ALL_EXPANSION, ...expansion } };
}

/** The server's answers: each condition matches the branches named after it, `name = 'x'` style. */
function answered(rules: readonly ExplorerRule[], answers: Record<string, RuleMatch>): RuleMatches {
  const queries = ruleQueries(rules);
  return ruleMatchesOf(queries, queries.map((query) => answers[query.condition] ?? { matched: [] }));
}

function kept(rules: ExplorerRule[], answers: Record<string, RuleMatch>): string[] | null {
  const result = branchesKeptByRules(family(), rules, answered(rules, answers));
  return result ? [...result].sort() : null;
}

describe('branchesKeptByRules', () => {
  it('keeps everything without rules', () => {
    expect(kept([], {})).toBeNull();
  });

  it('keeps only what an inclusion matched', () => {
    expect(kept([rule('include', 'A')], { A: { matched: ['/main/a'] } })).toEqual(['/main/a']);
  });

  it('joins what several inclusions matched', () => {
    const answers = { A: { matched: ['/main/a'] }, B: { matched: ['/main/b'] } };
    expect(kept([rule('include', 'A'), rule('include', 'B')], answers)).toEqual(['/main/a', '/main/b']);
  });

  it('takes every branch below with the child branches', () => {
    expect(kept([rule('include', 'M', { children: true })], { M: { matched: ['/main'] } })).toEqual(['/main', '/main/a', '/main/a/x', '/main/b']);
  });

  it('takes only the immediate parent with the parent branch', () => {
    expect(kept([rule('include', 'X', { parent: true })], { X: { matched: ['/main/a/x'] } })).toEqual(['/main/a', '/main/a/x']);
  });

  it('takes the branches merged into it with the merge sources', () => {
    expect(kept([rule('include', 'A', { mergeSources: true })], { A: { matched: ['/main/a'] } })).toEqual(['/main/a', '/main/a/x']);
  });

  it('takes the branches it was merged into with the merge destinations', () => {
    expect(kept([rule('include', 'A', { mergeDestinations: true })], { A: { matched: ['/main/a'] } })).toEqual(['/main', '/main/a']);
  });

  it('expands from what the rule matched, not from the relatives it took', () => {
    const rules = [rule('include', 'X', { parent: true, mergeDestinations: true })];
    // /main/a/x's parent is /main/a; /main/a's own merge into /main is not followed.
    expect(kept(rules, { X: { matched: ['/main/a/x'] } })).toEqual(['/main/a', '/main/a/x']);
  });

  it('hides what an exclusion matched and keeps the rest', () => {
    expect(kept([rule('exclude', 'B')], { B: { matched: ['/main/b'] } })).toEqual(['/main', '/main/a', '/main/a/x']);
  });

  it('hides the relatives an exclusion takes', () => {
    expect(kept([rule('exclude', 'A', { children: true })], { A: { matched: ['/main/a'] } })).toEqual(['/main', '/main/b']);
  });

  it('lets an exclusion win over an inclusion', () => {
    const rules = [rule('include', 'M', { children: true }), rule('exclude', 'X')];
    expect(kept(rules, { M: { matched: ['/main'] }, X: { matched: ['/main/a/x'] } })).toEqual(['/main', '/main/a', '/main/b']);
  });

  it('keeps nothing when the only inclusion matched nothing', () => {
    expect(kept([rule('include', 'none')], { none: { matched: [] } })).toEqual([]);
  });

  it('ignores matched branches the history did not load', () => {
    expect(kept([rule('include', 'A')], { A: { matched: ['/main/a', '/main/old'] } })).toEqual(['/main/a']);
  });

  it('leaves out a rule cm refused, a disabled one, and one not answered yet', () => {
    const refused = rule('include', 'bad');
    const disabled = { ...rule('include', 'A'), enabled: false };
    const rules = [refused, disabled];
    expect(kept(rules, { bad: { error: "Unknown field 'nmae'" }, A: { matched: ['/main/a'] } })).toBeNull();
    expect(branchesKeptByRules(family(), [rule('include', 'A')], new Map())).toBeNull();
  });
});

describe('ruleError', () => {
  it("names why cm refused a rule's condition", () => {
    const refused = rule('include', 'bad');
    const matches = answered([refused], { bad: { error: "Unknown field 'nmae'" } });
    expect(ruleError(refused, matches)).toBe("Unknown field 'nmae'");
  });

  it('is null for a rule that matched, or was not asked', () => {
    const ok = rule('include', 'A');
    expect(ruleError(ok, answered([ok], { A: { matched: [] } }))).toBeNull();
    expect(ruleError(newRule('pendingMerges', 'p'), new Map())).toBeNull();
  });
});
