import { describe, expect, it } from 'vitest';
import { newRule } from './explorerRules';
import { rulesOf, shownRuleMatches, withRules } from './rulesByRepository';
import type { RuleMatches } from './ruleMatches';

const mine = newRule('include', 'r1');
const theirs = newRule('exclude', 'r2');

describe('withRules', () => {
  it("changes only the repository's own rules", () => {
    const before = { game: [mine], tools: [theirs] };
    expect(withRules(before, 'game', [])).toEqual({ game: [], tools: [theirs] });
    expect(before).toEqual({ game: [mine], tools: [theirs] });
  });

  it('starts the rules of a repository that had none', () => {
    expect(withRules({}, 'game', [mine])).toEqual({ game: [mine] });
  });
});

describe('rulesOf', () => {
  it("reads the repository's rules", () => {
    expect(rulesOf({ game: [mine], tools: [theirs] }, 'tools')).toEqual([theirs]);
  });

  it('answers the same empty list for a repository without rules, or no repository yet', () => {
    // The same array every time: a store selector answering a new one would render forever.
    expect(rulesOf({}, 'game')).toBe(rulesOf({ tools: [theirs] }, undefined));
    expect(rulesOf({}, 'game')).toEqual([]);
  });
});

describe('shownRuleMatches', () => {
  const answered: RuleMatches = new Map([['q', { matched: ['/main'] }]]);

  it('shows the answers while some rule asks a question', () => {
    expect(shownRuleMatches(1, answered)).toBe(answered);
  });

  it('shows none once no rule asks one, even with an earlier answer kept', () => {
    expect(shownRuleMatches(0, answered).size).toBe(0);
  });

  it('shows none before the first answer arrives', () => {
    expect(shownRuleMatches(1, undefined).size).toBe(0);
  });
});
