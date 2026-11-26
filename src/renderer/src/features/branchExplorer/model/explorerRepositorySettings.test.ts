import { describe, expect, it } from 'vitest';
import { appliedExplorerRulesOf, appliedUserColorsOf, branchPinsOf, explorerRulesOf } from './explorerRepositorySettings';
import { newRule } from './explorerRules';

const rule = newRule('include', 'r1');
const colors = { users: [{ user: 'ana', hue: 120 }] };

describe('explorerRepositorySettings', () => {
  it('applies the repository’s rules while they’re on, keeping them while off', () => {
    expect(appliedExplorerRulesOf({ explorerRules: [rule] })).toEqual([rule]);
    expect(appliedExplorerRulesOf({ explorerRules: [rule], explorerRulesOff: true })).toEqual([]);
    expect(explorerRulesOf({ explorerRules: [rule], explorerRulesOff: true })).toEqual([rule]);
  });

  it('answers the same empty rules and pins for a repository with none, or rules off', () => {
    expect(explorerRulesOf({})).toBe(appliedExplorerRulesOf({ explorerRules: [rule], explorerRulesOff: true }));
    expect(branchPinsOf({})).toBe(branchPinsOf({}));
  });

  it('gives the repository’s moved branches', () => {
    expect(branchPinsOf({ branchPins: [{ branch: 4, row: 1 }] })).toEqual([{ branch: 4, row: 1 }]);
  });

  it('applies the changeset colors unless the repository turned them off, the same empty colors while off', () => {
    expect(appliedUserColorsOf(colors, {})).toBe(colors);
    expect(appliedUserColorsOf(colors, { changesetColorsOff: true })).toBe(appliedUserColorsOf({ users: [] }, { changesetColorsOff: true }));
    expect(appliedUserColorsOf(colors, { changesetColorsOff: true }).users).toEqual([]);
  });
});
