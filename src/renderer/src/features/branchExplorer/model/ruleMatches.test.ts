import { describe, expect, it } from 'vitest';
import { shownRuleMatches, type RuleMatches } from './ruleMatches';

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
