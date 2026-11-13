import { describe, expect, it } from 'vitest';
import { SUGGEST_TIP, suggestButtonOf, suggestLineLabel, suggestRequestOutcome } from './suggestButton';
import { FAILED, READING, readValue } from './suggestedChange';

describe('suggestButtonOf', () => {
  it("offers to suggest once the line's text is read", () => {
    expect(suggestButtonOf(readValue(['  speed = 1;']), 'Use the constant')).toEqual({ enabled: true, tip: SUGGEST_TIP });
  });

  it("waits for the line's text, and says when it can't be read", () => {
    expect(suggestButtonOf(READING, '')).toEqual({ enabled: false, tip: 'Reading the line…' });
    expect(suggestButtonOf(FAILED, '')).toEqual({ enabled: false, tip: "The line's text can't be read" });
  });

  it('offers it once per comment, as only the first suggestion is one', () => {
    expect(suggestButtonOf(readValue(['x']), '```suggestion\ny\n```')).toEqual({ enabled: false, tip: 'This comment already suggests a change' });
  });
});

describe('suggestRequestOutcome', () => {
  it('waits for the line, then inserts it', () => {
    expect(suggestRequestOutcome(READING, '')).toEqual({ kind: 'wait' });
    expect(suggestRequestOutcome(readValue(['x']), '')).toEqual({ kind: 'insert', lines: ['x'] });
  });

  it("says why it added none, rather than nothing: the line can't be read, or a suggestion is there already", () => {
    expect(suggestRequestOutcome(FAILED, '')).toEqual({ kind: 'refused', reason: "The line's text can't be read" });
    expect(suggestRequestOutcome(readValue(['x']), '```suggestion\ny\n```')).toEqual({ kind: 'refused', reason: 'This comment already suggests a change' });
  });
});

describe('suggestLineLabel', () => {
  it('names the line, as "Comment on line 42" does', () => {
    expect(suggestLineLabel({ lineNumber: 42 })).toBe('Suggest change on line 42');
  });
});
