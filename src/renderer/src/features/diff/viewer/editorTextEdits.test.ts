import { describe, expect, it } from 'vitest';
import { deletionEdits, holdsText } from './editorTextEdits';
import type { TextSpan } from './textSpans';

const span = (startLine: number, startCharacter: number, endLine = startLine, endCharacter = startCharacter): TextSpan => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

describe('holdsText', () => {
  it('tells selections holding text from bare carets', () => {
    expect(holdsText([span(0, 3), span(1, 1)])).toBe(false);
    expect(holdsText([span(0, 3), span(1, 1, 1, 2)])).toBe(true);
    expect(holdsText([])).toBe(false);
  });
});

describe('deletionEdits', () => {
  it('removes what each selection holds, across lines too', () => {
    expect(deletionEdits([span(0, 5, 1, 5), span(2, 0, 2, 3)])).toEqual([
      { range: span(0, 5, 1, 5), newText: '' },
      { range: span(2, 0, 2, 3), newText: '' },
    ]);
  });

  it('deletes nothing at a bare caret, unlike Backspace', () => {
    expect(deletionEdits([span(0, 3), span(1, 0, 1, 2)])).toEqual([{ range: span(1, 0, 1, 2), newText: '' }]);
  });
});
