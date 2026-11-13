import { describe, expect, it } from 'vitest';
import { SUGGEST_TIP, suggestButtonOf, suggestLineLabel } from './suggestButton';

describe('suggestButtonOf', () => {
  it("offers to suggest once the line's text is read", () => {
    expect(suggestButtonOf(['  speed = 1;'], 'Use the constant')).toEqual({ enabled: true, tip: SUGGEST_TIP });
  });

  it("waits for the line's text, and says when it can't be read", () => {
    expect(suggestButtonOf('reading', '')).toEqual({ enabled: false, tip: 'Reading the line…' });
    expect(suggestButtonOf('unknown', '')).toEqual({ enabled: false, tip: "The line's text can't be read" });
  });

  it('offers it once per comment, as only the first suggestion is one', () => {
    expect(suggestButtonOf(['x'], '```suggestion\ny\n```')).toEqual({ enabled: false, tip: 'This comment already suggests a change' });
  });
});

describe('suggestLineLabel', () => {
  it('names the line, as "Comment on line 42" does', () => {
    expect(suggestLineLabel({ lineNumber: 42 })).toBe('Suggest change on line 42');
  });
});
