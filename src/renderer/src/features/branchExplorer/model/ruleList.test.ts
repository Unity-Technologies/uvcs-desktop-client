import { describe, expect, it } from 'vitest';
import { newRule, NO_EXPANSION, type ExplorerRule, type ExplorerRuleKind } from './explorerRules';
import {
  ADD_RULE_GROUPS,
  addingTurnsRulesOn,
  addRule,
  canMoveRule,
  conditionHint,
  moveRule,
  removeRule,
  replaceRule,
  RULE_KIND_LABELS,
  ruleDraftProblem,
  ruleEditorTitle,
  ruleRowDetail,
  ruleRowTitle,
  ruleTabBody,
} from './ruleList';

function rule(kind: ExplorerRuleKind, id: string): ExplorerRule {
  return newRule(kind, id);
}

const ids = (rules: readonly ExplorerRule[]): string[] => rules.map((rule) => rule.id);

describe('the Add menu', () => {
  it('offers every kind of rule once', () => {
    expect(ADD_RULE_GROUPS.flat().sort()).toEqual(Object.keys(RULE_KIND_LABELS).sort());
  });
});

describe('ruleTabBody', () => {
  it('shows the empty state while there are no rules', () => {
    expect(ruleTabBody([])).toEqual({ state: 'empty' });
  });

  it('puts the filters apart from the formats, each in its order, and says how formats apply', () => {
    const rules = [rule('branchFormat', 'f1'), rule('include', 'i'), rule('currentBranch', 'f2'), rule('exclude', 'e')];
    const body = ruleTabBody(rules);
    expect(body.state === 'list' && body.sections.map((section) => [section.title, section.note, ids(section.rules)])).toEqual([
      ['Filters', null, ['i', 'e']],
      ['Formats', 'A later format colors over an earlier one.', ['f1', 'f2']],
    ]);
  });

  it('leaves out a section with no rules', () => {
    const body = ruleTabBody([rule('exclude', 'e')]);
    expect(body.state === 'list' && body.sections.map((section) => section.title)).toEqual(['Filters']);
  });
});

describe('adding a rule while the rules are off', () => {
  it('turns them on when it is the first, since the empty tab shows no switch', () => {
    expect(addingTurnsRulesOn([], false)).toBe(true);
  });

  it('leaves them off when there are rules already, whose switch says so', () => {
    expect(addingTurnsRulesOn([rule('exclude', 'e')], false)).toBe(false);
  });

  it('changes nothing when they are on', () => {
    expect(addingTurnsRulesOn([], true)).toBe(false);
  });
});

describe('a rule row', () => {
  it('reads the description, or the kind when there is none', () => {
    expect(ruleRowTitle({ ...rule('include', 'a'), description: 'Mine' })).toBe('Mine');
    expect(ruleRowTitle({ ...rule('labelFormat', 'a'), description: '  ' })).toBe('Label format');
  });

  it('shows the condition, and what a filter takes with it', () => {
    const filter = { ...rule('include', 'a'), description: '', condition: "owner = 'me'", expansion: { ...NO_EXPANSION, children: true, mergeSources: true } };
    expect(ruleRowDetail(filter)).toBe("owner = 'me' · with child branches and branches merged into them");
    expect(ruleRowDetail({ ...filter, expansion: { ...NO_EXPANSION, parent: true } })).toBe("owner = 'me' · with parent branch");
  });

  it('names a built-in format by what it colors under its description, and says when a condition is missing', () => {
    expect(ruleRowDetail({ ...rule('pendingMerges', 'a'), description: 'To merge' })).toBe('Branches with pending merges');
    expect(ruleRowDetail({ ...rule('exclude', 'a'), description: '', condition: ' ' })).toBe('No condition yet');
  });

  it('names the kind of a rule titled by its description, so an inclusion reads apart from an exclusion', () => {
    expect(ruleRowDetail({ ...rule('exclude', 'a'), description: 'Not old fixes', condition: "name like '%fix%'" })).toBe(
      "Exclusion · name like '%fix%'",
    );
    expect(ruleRowDetail({ ...rule('labelFormat', 'a'), description: 'Releases', condition: "name like 'v%'" })).toBe(
      "Label format · name like 'v%'",
    );
  });

  it('has no second line for a built-in format already titled by its kind', () => {
    expect(ruleRowDetail(rule('currentBranch', 'a'))).toBeNull();
  });
});

describe('changing the list', () => {
  const rules = [rule('include', 'i'), rule('branchFormat', 'b'), rule('exclude', 'e'), rule('labelFormat', 'l')];

  it('adds at the end, replaces in place and removes by id', () => {
    expect(ids(addRule(rules, rule('currentBranch', 'c')))).toEqual(['i', 'b', 'e', 'l', 'c']);
    expect(replaceRule(rules, { ...rules[1]!, description: 'Changed' })[1]!.description).toBe('Changed');
    expect(ids(removeRule(rules, 'e'))).toEqual(['i', 'b', 'l']);
  });

  it('moves a format past the filters to the next format', () => {
    expect(ids(moveRule(rules, 'b', 1))).toEqual(['i', 'l', 'e', 'b']);
    expect(ids(moveRule(rules, 'l', -1))).toEqual(['i', 'l', 'e', 'b']);
  });

  it('moves nothing past the ends, and never a filter', () => {
    expect(canMoveRule(rules, 'b', -1)).toBe(false);
    expect(canMoveRule(rules, 'l', 1)).toBe(false);
    expect(canMoveRule(rules, 'b', 1)).toBe(true);
    expect(canMoveRule(rules, 'i', 1)).toBe(false);
    expect(ids(moveRule(rules, 'i', 1))).toEqual(ids(rules));
  });
});

describe('the rule editor', () => {
  it('saves a rule only with a condition, unless it is built in', () => {
    expect(ruleDraftProblem({ ...rule('include', 'a'), condition: '  ' })).toBe('Write which ones it matches');
    expect(ruleDraftProblem(rule('include', 'a'))).toBeNull();
    expect(ruleDraftProblem(rule('currentBranch', 'a'))).toBeNull();
  });

  it('hints a condition for each kind that has one', () => {
    expect(conditionHint('changesetFormat')).toContain('changesets');
    expect(conditionHint('pendingMerges')).toBeNull();
  });

  it('is titled by what it creates or edits', () => {
    expect(ruleEditorTitle('include', true)).toBe('New inclusion');
    expect(ruleEditorTitle('labelFormat', false)).toBe('Edit label format');
  });
});
