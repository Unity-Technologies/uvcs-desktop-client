import { describe, expect, it } from 'vitest';
import { hasCondition, isFilterRule, isFormatRule, NO_EXPANSION, newRule, ruleQueries, ruleQueryKey, ruleQueryOf } from './explorerRules';

describe('newRule', () => {
  it('starts enabled, taking no relatives, with an example condition to edit', () => {
    expect(newRule('include', 'r1')).toEqual({
      id: 'r1',
      kind: 'include',
      enabled: true,
      description: 'Main branch',
      condition: "name = '/main'",
      expansion: NO_EXPANSION,
      hue: null,
    });
  });

  it('gives format rules a color and filters none', () => {
    expect(newRule('changesetFormat', 'r').hue).not.toBeNull();
    expect(newRule('pendingMerges', 'r').hue).not.toBeNull();
    expect(newRule('exclude', 'r').hue).toBeNull();
  });

  it('leaves the built-in formats without a condition', () => {
    expect(newRule('pendingMerges', 'r').condition).toBe('');
    expect(newRule('currentBranch', 'r').condition).toBe('');
    expect(hasCondition('pendingMerges')).toBe(false);
    expect(hasCondition('currentBranch')).toBe(false);
    expect(hasCondition('labelFormat')).toBe(true);
  });
});

describe('isFilterRule and isFormatRule', () => {
  it('tell inclusions and exclusions from formats', () => {
    expect(isFilterRule(newRule('include', 'r'))).toBe(true);
    expect(isFilterRule(newRule('exclude', 'r'))).toBe(true);
    expect(isFormatRule(newRule('branchFormat', 'r'))).toBe(true);
    expect(isFormatRule(newRule('currentBranch', 'r'))).toBe(true);
  });
});

describe('ruleQueryOf', () => {
  it('asks for the objects the rule is about', () => {
    expect(ruleQueryOf(newRule('exclude', 'r'))).toEqual({ object: 'branch', condition: "name like '%experiment%'" });
    expect(ruleQueryOf(newRule('branchFormat', 'r'))?.object).toBe('branch');
    expect(ruleQueryOf(newRule('changesetFormat', 'r'))?.object).toBe('changeset');
    expect(ruleQueryOf(newRule('labelFormat', 'r'))?.object).toBe('label');
  });

  it('trims the condition', () => {
    expect(ruleQueryOf({ ...newRule('include', 'r'), condition: "  owner = 'me'\n" })?.condition).toBe("owner = 'me'");
  });

  it('asks nothing for a disabled rule, a built-in one, or an empty condition', () => {
    expect(ruleQueryOf({ ...newRule('include', 'r'), enabled: false })).toBeNull();
    expect(ruleQueryOf(newRule('pendingMerges', 'r'))).toBeNull();
    expect(ruleQueryOf(newRule('currentBranch', 'r'))).toBeNull();
    expect(ruleQueryOf({ ...newRule('include', 'r'), condition: '   ' })).toBeNull();
  });
});

describe('ruleQueries', () => {
  it('asks each question once, whatever rules share it', () => {
    const include = newRule('include', 'a');
    const exclude = { ...newRule('exclude', 'b'), condition: include.condition };
    expect(ruleQueries([include, exclude])).toEqual([{ object: 'branch', condition: "name = '/main'" }]);
  });

  it('keeps the same condition on different objects apart', () => {
    const branch = { ...newRule('branchFormat', 'a'), condition: "owner = 'me'" };
    const changeset = { ...newRule('changesetFormat', 'b'), condition: "owner = 'me'" };
    expect(ruleQueries([branch, changeset])).toHaveLength(2);
  });

  it('is the same for the same rules in any order', () => {
    const rules = [newRule('include', 'a'), newRule('labelFormat', 'b'), newRule('changesetFormat', 'c')];
    expect(ruleQueries([...rules].reverse())).toEqual(ruleQueries(rules));
  });

  it('leaves out the rules that ask nothing', () => {
    expect(ruleQueries([newRule('pendingMerges', 'a'), { ...newRule('include', 'b'), enabled: false }])).toEqual([]);
  });
});

describe('ruleQueryKey', () => {
  it('tells apart queries whose object and condition only join the same way', () => {
    expect(ruleQueryKey({ object: 'branch', condition: 'x' })).not.toBe(ruleQueryKey({ object: 'label', condition: 'x' }));
  });
});
