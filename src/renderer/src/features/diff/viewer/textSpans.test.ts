import { describe, expect, it } from 'vitest';
import { isEmptySpan, orderedSpan, shownLineCount, spanLines, spanText, wholeTextSpan, type TextSpan } from './textSpans';

const span = (startLine: number, startCharacter: number, endLine: number, endCharacter: number): TextSpan => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

const TEXT = 'const a = 1;\nconst b = 2;\nconst c = 3;\n';

describe('spanText', () => {
  it('takes part of a line', () => {
    expect(spanText(TEXT, span(1, 6, 1, 7))).toBe('b');
  });

  it('takes the end of a line, the lines between and the start of the last', () => {
    expect(spanText(TEXT, span(0, 10, 2, 7))).toBe('1;\nconst b = 2;\nconst c');
  });

  it('takes a selection made backwards as the same text', () => {
    expect(spanText(TEXT, span(2, 7, 0, 10))).toBe('1;\nconst b = 2;\nconst c');
  });

  it("joins a CRLF or CR file's lines with LF, as they show, the CR no character of its own", () => {
    expect(spanText('one\r\ntwo\r\nthree', span(0, 1, 2, 2))).toBe('ne\ntwo\nth');
    expect(spanText('one\rtwo', span(0, 0, 1, 3))).toBe('one\ntwo');
  });

  it('counts characters as the editor does, in UTF-16 units, so text past an emoji or an accent stays whole', () => {
    expect(spanText('let 🙂 = "café";\n', span(0, 7, 0, 15))).toBe('= "café"');
  });

  it('keeps a span read from the page within the text', () => {
    expect(spanText('ab\ncd', span(1, 1, 9, 99))).toBe('d');
    expect(spanText('ab', span(0, 5, 0, 9))).toBe('');
  });
});

describe('spanLines', () => {
  it('names the lines a span covers, one-based', () => {
    expect(spanLines(span(3, 2, 3, 5))).toEqual({ first: 4, last: 4 });
    expect(spanLines(span(5, 0, 3, 2))).toEqual({ first: 4, last: 5 });
  });

  it("doesn't count the line a span ends at the start of", () => {
    expect(spanLines(span(3, 0, 6, 0))).toEqual({ first: 4, last: 6 });
  });
});

describe('the whole text', () => {
  it('spans to the end of the last line', () => {
    expect(wholeTextSpan(TEXT)).toEqual(span(0, 0, 3, 0));
    expect(wholeTextSpan('a\r\nbc')).toEqual(span(0, 0, 1, 2));
    expect(spanText(TEXT, wholeTextSpan(TEXT))).toBe(TEXT);
  });

  it('counts the lines it shows: a final line break ends the last line, and an empty text has one', () => {
    expect(shownLineCount(TEXT)).toBe(3);
    expect(shownLineCount('a\r\nb')).toBe(2);
    expect(shownLineCount('')).toBe(1);
    expect(shownLineCount('\n\n')).toBe(2);
  });
});

describe('orderedSpan and isEmptySpan', () => {
  it('puts the start first and tells a caret from a selection', () => {
    expect(orderedSpan(span(2, 1, 2, 0))).toEqual(span(2, 0, 2, 1));
    expect(isEmptySpan(span(2, 1, 2, 1))).toBe(true);
    expect(isEmptySpan(span(2, 1, 3, 1))).toBe(false);
  });
});
