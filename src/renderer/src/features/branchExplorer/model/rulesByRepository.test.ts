import { describe, expect, it } from 'vitest';
import { newRule } from './explorerRules';
import { appliedRulesOf, rulesOf, withRules } from './rulesByRepository';

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

describe('appliedRulesOf', () => {
  it("applies the repository's rules while they're on", () => {
    expect(appliedRulesOf({ game: [mine] }, { tools: true }, 'game')).toEqual([mine]);
  });

  it("applies none while they're off, keeping them", () => {
    const rulesByRepository = { game: [mine] };
    expect(appliedRulesOf(rulesByRepository, { game: true }, 'game')).toBe(rulesOf({}, 'game'));
    expect(rulesOf(rulesByRepository, 'game')).toEqual([mine]);
  });
});
