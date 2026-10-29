import { describe, expect, it } from 'vitest';
import { ChangeSet } from '@codemirror/state';
import type { FencedCode, TokenMark } from './codeHighlight';
import { codeColorsAfter, mapMarks, type Colored } from './codeColorDrawing';

const keyword = 'color: blue';
const number = 'color: green';

describe('mapMarks', () => {
  // `let a = 1;` with `let` and `1` colored.
  const marks: TokenMark[] = [
    { from: 0, to: 3, style: keyword },
    { from: 8, to: 9, style: number },
  ];

  it('moves the colors already drawn with the text a key moved', () => {
    const typed = ChangeSet.of({ from: 4, insert: 'b' }, 10);
    expect(mapMarks(marks, typed)).toEqual([
      { from: 0, to: 3, style: keyword },
      { from: 9, to: 10, style: number },
    ]);
  });

  it('leaves a character typed at a colored run’s edge uncolored until the code is colored again', () => {
    const typed = ChangeSet.of({ from: 3, insert: 'x' }, 10);
    expect(mapMarks(marks, typed)).toEqual([
      { from: 0, to: 3, style: keyword },
      { from: 9, to: 10, style: number },
    ]);
  });

  it('drops a colored run whose text was deleted', () => {
    const deleted = ChangeSet.of({ from: 0, to: 4 }, 10);
    expect(mapMarks(marks, deleted)).toEqual([{ from: 4, to: 5, style: number }]);
  });
});

describe('codeColorsAfter', () => {
  const edited: FencedCode = { from: 20, text: 'let ab = 1;', language: 'ts' };
  const other: FencedCode = { from: 50, text: 'var c;', language: 'ts' };
  const kept: TokenMark[] = [
    { from: 20, to: 23, style: keyword },
    { from: 29, to: 30, style: number },
    { from: 50, to: 53, style: keyword },
  ];

  it('keeps the colors drawn on a block whose new ones aren’t read yet, and asks for them', () => {
    const colors = new Map<FencedCode, Colored>([[other, [{ from: 0, to: 3, style: keyword }]]]);
    expect(codeColorsAfter([edited, other], (block) => colors.get(block), kept)).toEqual({ marks: kept, uncolored: [edited] });
  });

  it('draws each block’s colors once read, the other blocks’ as they were', () => {
    const colors = new Map<FencedCode, Colored>([
      [edited, [{ from: 0, to: 2, style: keyword }]],
      [other, [{ from: 0, to: 3, style: keyword }]],
    ]);
    expect(codeColorsAfter([edited, other], (block) => colors.get(block), kept)).toEqual({
      marks: [
        { from: 20, to: 22, style: keyword },
        { from: 50, to: 53, style: keyword },
      ],
      uncolored: [],
    });
  });

  it('keeps a block being read as it was drawn, without asking for it again', () => {
    expect(codeColorsAfter([edited], () => 'reading', kept)).toEqual({ marks: kept.slice(0, 2), uncolored: [] });
  });

  it('shows plain a block in a language the highlighter doesn’t know', () => {
    expect(codeColorsAfter([edited], () => 'none', kept)).toEqual({ marks: [], uncolored: [] });
  });
});
