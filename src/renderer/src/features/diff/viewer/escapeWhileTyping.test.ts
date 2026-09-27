import { describe, expect, it } from 'vitest';
import { escapeWhileTyping } from './escapeWhileTyping';

const at = (line: number, character: number) => ({ line, character });
const caret = (line: number, character: number) => ({ start: at(line, character), end: at(line, character) });

describe('escapeWhileTyping', () => {
  it('drops the picked lines first, whatever the editor holds', () => {
    expect(escapeWhileTyping([{ start: at(1, 0), end: at(3, 2) }], true)).toBe('pick');
  });

  it("leaves a selection or extra carets to the editor, which drops them", () => {
    expect(escapeWhileTyping([{ start: at(1, 0), end: at(1, 4) }], false)).toBe('editor');
    expect(escapeWhileTyping([caret(1, 0), caret(2, 0)], false)).toBe('editor');
  });

  it('leaves the text for the file list when there is just a caret', () => {
    expect(escapeWhileTyping([caret(4, 2)], false)).toBe('leave');
    expect(escapeWhileTyping([], false)).toBe('leave');
  });
});
