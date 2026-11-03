import { describe, expect, it } from 'vitest';
import type { BranchExplorerData, RuleMatch } from '@shared/domain/branchExplorer';
import { newRule, ruleQueries, type ExplorerRule, type ExplorerRuleKind } from './explorerRules';
import { branch, changeset, merge, sampleHistory } from './graphFixtures';
import { branchesWithPendingMerges, NO_RULE_COLORS, ruleColors } from './ruleColors';
import { ruleMatchesOf, type RuleMatches } from './ruleMatches';

function rule(kind: ExplorerRuleKind, hue: number, condition = ''): ExplorerRule {
  return { ...newRule(kind, `${kind}-${hue}`), hue, condition };
}

function answered(rules: readonly ExplorerRule[], answers: Record<string, RuleMatch>): RuleMatches {
  const queries = ruleQueries(rules);
  return ruleMatchesOf(queries, queries.map((query) => answers[query.condition] ?? { matched: [] }));
}

describe('ruleColors', () => {
  it('colors nothing without format rules', () => {
    expect(ruleColors(sampleHistory(), [], new Map(), '/main')).toBe(NO_RULE_COLORS);
  });

  it('colors the branches, changesets and labels each rule matched', () => {
    const rules = [rule('branchFormat', 10, 'B'), rule('changesetFormat', 20, 'C'), rule('labelFormat', 30, 'L')];
    const colors = ruleColors(sampleHistory(), rules, answered(rules, { B: { matched: ['/main/b'] }, C: { matched: ['4', '5'] }, L: { matched: ['v1'] } }), null);
    expect([...colors.branches]).toEqual([['/main/b', 10]]);
    expect([...colors.changesets]).toEqual([[4, 20], [5, 20]]);
    expect([...colors.labels]).toEqual([['v1', 30]]);
  });

  it('lets a later rule recolor what an earlier one colored', () => {
    const rules = [rule('branchFormat', 10, 'first'), rule('branchFormat', 20, 'second')];
    const colors = ruleColors(sampleHistory(), rules, answered(rules, { first: { matched: ['/main/a', '/main/b'] }, second: { matched: ['/main/b'] } }), null);
    expect(colors.branches.get('/main/a')).toBe(10);
    expect(colors.branches.get('/main/b')).toBe(20);
  });

  it('colors the workspace branch, and nothing without a workspace', () => {
    const rules = [rule('currentBranch', 40)];
    expect([...ruleColors(sampleHistory(), rules, new Map(), '/main/a').branches]).toEqual([['/main/a', 40]]);
    expect(ruleColors(sampleHistory(), rules, new Map(), null)).toBe(NO_RULE_COLORS);
  });

  it('colors the branches with pending merges', () => {
    expect([...ruleColors(sampleHistory(), [rule('pendingMerges', 50)], new Map(), null).branches]).toEqual([['/main/b', 50]]);
  });

  it('leaves out disabled rules, refused ones and ones not answered yet', () => {
    const disabled = { ...rule('pendingMerges', 50), enabled: false };
    const refused = rule('labelFormat', 30, 'bad');
    const waiting = rule('branchFormat', 10, 'later');
    const matches = ruleMatchesOf([{ object: 'label', condition: 'bad' }], [{ error: 'Unknown field' }]);
    expect(ruleColors(sampleHistory(), [disabled, refused, waiting], matches, null)).toBe(NO_RULE_COLORS);
  });
});

describe('branchesWithPendingMerges', () => {
  it('finds child branches with changes never merged out, but not top-level ones', () => {
    // /main/a was merged into /main at its head; /main/b never was.
    expect([...branchesWithPendingMerges(sampleHistory())]).toEqual(['/main/b']);
  });

  it('finds a branch that changed after its last merge out', () => {
    const data = sampleHistory();
    data.changesets.push(changeset(8, '/main/a', 5));
    expect([...branchesWithPendingMerges(data)].sort()).toEqual(['/main/a', '/main/b']);
  });

  it('counts only merges that take the branch whole', () => {
    const data = sampleHistory();
    data.mergeLinks = [{ ...merge(5, 6), type: 'cherryPick' }];
    expect([...branchesWithPendingMerges(data)].sort()).toEqual(['/main/a', '/main/b']);
    data.mergeLinks = [{ ...merge(5, 6), type: 'interval' }];
    expect([...branchesWithPendingMerges(data)]).toEqual(['/main/b']);
  });

  it('skips a child branch with no changeset loaded', () => {
    const data: BranchExplorerData = { ...sampleHistory(), branches: [...sampleHistory().branches, branch('/main/empty', '/main')] };
    expect(branchesWithPendingMerges(data).has('/main/empty')).toBe(false);
  });
});
