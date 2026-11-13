import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { FAILED, READING, readValue, commentedLines, rangeWords, replacedLinesIn, suggestedChangeOf, suggestionRows, suggestionTitle } from './suggestedChange';

const ON_LINE: ReviewComment['anchor'] = { kind: 'line', revisionId: 42, itemId: 7, path: '/src/Player.cs', line: 3 };
const SUGGESTING = 'Use the constant\n```suggestion\n  speed = MAX_SPEED;\n```';

describe('suggestedChangeOf', () => {
  it("reads a change request's suggestion as replacing its line of its revision", () => {
    expect(suggestedChangeOf({ kind: 'changeRequest', anchor: ON_LINE, text: SUGGESTING })).toEqual({
      path: 'src/Player.cs',
      revisionId: 42,
      firstLine: 3,
      lastLine: 3,
      lines: ['  speed = MAX_SPEED;'],
    });
  });

  it('reads none in a question, a comment or a comment on the whole review: only a change request is applied', () => {
    expect(suggestedChangeOf({ kind: 'question', anchor: ON_LINE, text: SUGGESTING })).toBeNull();
    expect(suggestedChangeOf({ kind: 'comment', anchor: ON_LINE, text: SUGGESTING })).toBeNull();
    expect(suggestedChangeOf({ kind: 'changeRequest', anchor: { kind: 'review' }, text: SUGGESTING })).toBeNull();
  });

  it('reads none in a change request without a suggestion fence', () => {
    expect(suggestedChangeOf({ kind: 'changeRequest', anchor: ON_LINE, text: '```cs\nx\n```' })).toBeNull();
  });
});

describe('replacedLinesIn', () => {
  const change = { firstLine: 2, lastLine: 2 };

  it('takes the line from the version, whatever its line ends', () => {
    expect(replacedLinesIn(readValue('a\r\nb\r\nc'), change)).toEqual(readValue(['b']));
    expect(replacedLinesIn(readValue('a\nb\n'), change)).toEqual(readValue(['b']));
    expect(replacedLinesIn(readValue('a\rb'), change)).toEqual(readValue(['b']));
  });

  it('takes every line of a range', () => {
    expect(replacedLinesIn(readValue('a\r\nb\r\nc\r\nd'), { firstLine: 2, lastLine: 4 })).toEqual(readValue(['b', 'c', 'd']));
    expect(replacedLinesIn(readValue('a\nb\n'), { firstLine: 2, lastLine: 3 })).toEqual(FAILED);
  });

  it('tells a version still read from one that failed, has no text, or is shorter than the line', () => {
    expect(replacedLinesIn(READING, change)).toEqual(READING);
    expect(replacedLinesIn(FAILED, change)).toEqual(FAILED);
    expect(replacedLinesIn(readValue(null), change)).toEqual(FAILED);
    expect(replacedLinesIn(readValue('only one'), change)).toEqual(FAILED);
  });

  it("reads a version whose text is the word 'failed' as text", () => {
    expect(replacedLinesIn(readValue('failed\nreading\n'), change)).toEqual(readValue(['reading']));
  });
});

describe('suggestionRows', () => {
  it('shows the line removed, then the suggested lines added', () => {
    expect(suggestionRows(readValue(['old']), ['new 1', 'new 2'])).toEqual([
      { kind: 'removed', text: 'old' },
      { kind: 'added', text: 'new 1' },
      { kind: 'added', text: 'new 2' },
    ]);
  });

  it('shows a range as all its lines removed, then the suggested ones added', () => {
    expect(suggestionRows(readValue(['a', 'b']), ['ab'])).toEqual([
      { kind: 'removed', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'ab' },
    ]);
  });

  it('shows a deletion as the line removed alone', () => {
    expect(suggestionRows(readValue(['old']), [])).toEqual([{ kind: 'removed', text: 'old' }]);
  });

  it("holds the removed line's place while it's read, and shows the suggested lines alone when it can't be", () => {
    expect(suggestionRows(READING, ['new'])).toEqual([{ kind: 'reading' }, { kind: 'added', text: 'new' }]);
    expect(suggestionRows(FAILED, ['new'])).toEqual([{ kind: 'added', text: 'new' }]);
  });
});

describe('suggestionTitle', () => {
  it('says when the suggestion deletes the line', () => {
    expect(suggestionTitle({ firstLine: 3, lastLine: 3, lines: [] })).toBe('Suggested change: delete the line');
    expect(suggestionTitle({ firstLine: 3, lastLine: 5, lines: [] })).toBe('Suggested change: delete the lines');
    expect(suggestionTitle({ firstLine: 3, lastLine: 5, lines: ['x'] })).toBe('Suggested change');
  });
});

describe('commentedLines', () => {
  it("is the one line cm names a comment by, today", () => {
    expect(commentedLines({ line: 7 })).toEqual({ firstLine: 7, lastLine: 7 });
  });
});

describe('rangeWords', () => {
  it('names one line or a range', () => {
    expect(rangeWords({ firstLine: 7, lastLine: 7 })).toBe('Line 7');
    expect(rangeWords({ firstLine: 7, lastLine: 9 })).toBe('Lines 7–9');
  });
});
