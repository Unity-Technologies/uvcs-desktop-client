import { describe, expect, it } from 'vitest';
import { refusalShown, SUGGEST_LINES_TIP, SUGGEST_TIP, suggestButtonOf, suggestLineLabel, suggestRequestOutcome, withSuggestionInserted } from './suggestButton';
import { FAILED, READING, readValue } from './suggestedChange';

const LINE = { firstLine: 7, lastLine: 7 };
const RANGE = { firstLine: 7, lastLine: 9 };

describe('suggestButtonOf', () => {
  it("offers to suggest once the line's text is read", () => {
    expect(suggestButtonOf(readValue(['  speed = 1;']), 'Use the constant', LINE)).toEqual({ enabled: true, tip: SUGGEST_TIP });
  });

  it("waits for the line's text, and says when it can't be read", () => {
    expect(suggestButtonOf(READING, '', LINE)).toEqual({ enabled: false, tip: 'Reading the line…' });
    expect(suggestButtonOf(FAILED, '', LINE)).toEqual({ enabled: false, tip: "The line's text can't be read" });
  });

  it('offers it once per comment, as only the first suggestion is one', () => {
    expect(suggestButtonOf(readValue(['x']), '```suggestion\ny\n```', LINE)).toEqual({ enabled: false, tip: 'This comment already suggests a change' });
  });
});

describe('suggestButtonOf on a range', () => {
  it('says "lines" for a comment on several', () => {
    expect(suggestButtonOf(readValue(['a', 'b', 'c']), '', RANGE)).toEqual({ enabled: true, tip: SUGGEST_LINES_TIP });
    expect(suggestButtonOf(READING, '', RANGE).tip).toBe('Reading the lines…');
    expect(suggestButtonOf(FAILED, '', RANGE).tip).toBe("The lines' text can't be read");
  });
});

describe('suggestRequestOutcome', () => {
  it('waits for the line, then inserts it', () => {
    expect(suggestRequestOutcome(READING, '', LINE)).toEqual({ kind: 'wait' });
    expect(suggestRequestOutcome(readValue(['x']), '', LINE)).toEqual({ kind: 'insert', lines: ['x'] });
  });

  it("says why it added none, rather than nothing: the line can't be read, or a suggestion is there already", () => {
    expect(suggestRequestOutcome(FAILED, '', LINE)).toEqual({ kind: 'refused', reason: "The line's text can't be read" });
    expect(suggestRequestOutcome(readValue(['x']), '```suggestion\ny\n```', LINE)).toEqual({ kind: 'refused', reason: 'This comment already suggests a change' });
  });
});

describe('refusalShown', () => {
  const refusal = { reason: "The line's text can't be read", text: 'Use the constant' };

  it('says why no suggestion was added while the comment is as it was then', () => {
    expect(refusalShown(refusal, 'Use the constant')).toBe("The line's text can't be read");
  });

  it('stops once the comment changes: typed in, or a suggestion inserted', () => {
    expect(refusalShown(refusal, 'Use the constant.')).toBeNull();
    expect(refusalShown(refusal, 'Use the constant\n```suggestion\nx\n```')).toBeNull();
    expect(refusalShown(null, 'Use the constant')).toBeNull();
  });
});

describe('suggestLineLabel', () => {
  it('names the lines, as "Comment on line 42" does', () => {
    expect(suggestLineLabel({ firstLineNumber: 42, lineNumber: 42 })).toBe('Suggest change on line 42');
    expect(suggestLineLabel({ firstLineNumber: 40, lineNumber: 42 })).toBe('Suggest change on lines 40–42');
  });
});

describe('withSuggestionInserted', () => {
  it('inserts the suggestion at the caret and makes the comment a change request', () => {
    expect(withSuggestionInserted('Why not 60?', 11, ['  speed = 60;'])).toEqual({
      text: 'Why not 60?\n```suggestion\n  speed = 60;\n```',
      caret: 'Why not 60?\n```suggestion\n  speed = 60;'.length,
      kind: 'changeRequest',
    });
  });
});
