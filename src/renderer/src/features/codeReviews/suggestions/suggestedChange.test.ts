import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { FAILED, READING, readValue, commentedLines, rangeWords, replacedLinesIn, suggestedChangeOf, suggestionBody, suggestionTitle } from './suggestedChange';

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

describe('suggestionBody', () => {
  const change = { firstLine: 3, lastLine: 3, lines: ['new 1', 'new 2'] };

  it('is the diff of the lines replaced to those suggested, each ending in a line end, as a file holding them', () => {
    expect(suggestionBody(change, readValue(['old']))).toEqual({ kind: 'diff', replacedText: 'old\n', suggestedText: 'new 1\nnew 2\n', rowCount: 3 });
  });

  it('diffs a range as all its lines replaced', () => {
    expect(suggestionBody({ firstLine: 3, lastLine: 4, lines: ['ab'] }, readValue(['a', 'b']))).toEqual({ kind: 'diff', replacedText: 'a\nb\n', suggestedText: 'ab\n', rowCount: 3 });
  });

  it('diffs a deletion as the line removed alone', () => {
    expect(suggestionBody({ ...change, lines: [] }, readValue(['old']))).toEqual({ kind: 'diff', replacedText: 'old\n', suggestedText: '', rowCount: 1 });
  });

  it('keeps an empty line as a line', () => {
    expect(suggestionBody({ ...change, lines: [''] }, readValue(['old']))).toEqual({ kind: 'diff', replacedText: 'old\n', suggestedText: '\n', rowCount: 2 });
  });

  it('says the suggestion is the lines as they are when it changes nothing, rather than a diff of no change', () => {
    expect(suggestionBody({ firstLine: 13, lastLine: 13, lines: ['old'] }, readValue(['old']))).toEqual({ kind: 'unchanged', note: 'The suggestion is line 13 as it is' });
    expect(suggestionBody({ firstLine: 3, lastLine: 4, lines: ['a', 'b'] }, readValue(['a', 'b']))).toEqual({ kind: 'unchanged', note: 'The suggestion is lines 3–4 as they are' });
    // Indentation counts: a line only reindented is a change.
    expect(suggestionBody({ firstLine: 3, lastLine: 3, lines: [' old'] }, readValue(['old']))).toMatchObject({ kind: 'diff' });
  });

  it("holds the rows' place while the replaced lines are read, so nothing moves as they arrive", () => {
    expect(suggestionBody(change, READING)).toEqual({ kind: 'reading', rowCount: 3 });
    expect(suggestionBody({ firstLine: 3, lastLine: 5, lines: ['x'] }, READING)).toEqual({ kind: 'reading', rowCount: 4 });
  });

  it("shows the suggested lines alone when the replaced ones can't be read, and nothing for a deletion then", () => {
    expect(suggestionBody(change, FAILED)).toEqual({ kind: 'diff', replacedText: '', suggestedText: 'new 1\nnew 2\n', rowCount: 2 });
    expect(suggestionBody({ ...change, lines: [] }, FAILED)).toEqual({ kind: 'empty' });
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
