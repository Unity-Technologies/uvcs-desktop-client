import { describe, expect, it } from 'vitest';
import { mergeRuleNotice, mergeRuleRefusal } from './mergeRuleRefusal';

describe('mergeRuleRefusal', () => {
  it('recognizes a branch that needs an open merge request to its destination', () => {
    expect(mergeRuleRefusal("Cannot perform the merge because of the Merge Rules. Branch '/main/task1' needs an open merge request to '/main'.")).toEqual({
      rule: 'needsMergeRequest',
      source: '/main/task1',
      destination: '/main',
    });
  });

  it('recognizes a branch that must be reviewed before it merges', () => {
    expect(mergeRuleRefusal("Cannot perform the merge because of the Merge Rules. Review the branch '/main/task1' to merge it to '/main'.")).toEqual({
      rule: 'needsReview',
      source: '/main/task1',
      destination: '/main',
    });
  });

  it('keeps branch names with spaces and accents whole', () => {
    expect(mergeRuleRefusal("Cannot perform the merge because of the Merge Rules. Branch '/main/versión 2/add login' needs an open merge request to '/main/versión 2'.")).toEqual({
      rule: 'needsMergeRequest',
      source: '/main/versión 2/add login',
      destination: '/main/versión 2',
    });
  });

  it('finds the rule inside a longer message, as an error prints it', () => {
    expect(mergeRuleRefusal("Error: Cannot perform the merge because of the Merge Rules. Review the branch '/main/task1' to merge it to '/main'.\r\n")?.rule).toBe('needsReview');
  });

  it("leaves every other failure to cm's own message", () => {
    expect(mergeRuleRefusal("The current Merge Rules configuration doesn't allow branch '/main/task1' to be merged into '/main'.")).toBeUndefined();
    expect(mergeRuleRefusal('The specified branch /main/nope can\'t be found.')).toBeUndefined();
    expect(mergeRuleRefusal('')).toBeUndefined();
  });

  it("leaves a translated message to cm's own words", () => {
    expect(mergeRuleRefusal("No se puede realizar el merge debido al sistema de reglas de merge. La rama origen '/main/task1' tiene que estar revisada con éxito antes de que se pueda hacer merge a '/main'.")).toBeUndefined();
  });
});

describe('mergeRuleNotice', () => {
  const refusal = (rule: 'needsMergeRequest' | 'needsReview') => ({ rule, source: '/main/task1', destination: '/main' }) as const;

  it('says a branch needs an open merge request, plainly', () => {
    expect(mergeRuleNotice(refusal('needsMergeRequest'), undefined)).toEqual({ title: 'This server merges into main only branches with an open merge request' });
  });

  it("opens the branch's merge request when it must be reviewed first", () => {
    expect(mergeRuleNotice(refusal('needsReview'), 12)).toEqual({
      title: 'This server merges into main only reviewed branches',
      action: { kind: 'openMergeRequest', reviewId: 12, label: 'Open merge request' },
    });
  });

  it('offers nothing to open when the branch has no merge request into that destination', () => {
    expect(mergeRuleNotice(refusal('needsReview'), undefined)).toEqual({ title: 'This server merges into main only reviewed branches' });
  });
});
