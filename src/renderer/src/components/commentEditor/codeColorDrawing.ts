import type { ChangeDesc } from '@codemirror/state';
import type { FencedCode, TokenMark } from './codeHighlight';

/** A block's colors (from its code's start), or why it has none yet: being read, or a language with no colors. */
export type Colored = TokenMark[] | 'reading' | 'none';

/**
 * The colors drawn, moved with the text an edit moved: a key typed into code keeps the colors around it where they
 * were, a character typed at a run's edge plain until the code is colored again. A run whose text went is dropped.
 */
export function mapMarks(marks: readonly TokenMark[], changes: ChangeDesc): TokenMark[] {
  const mapped: TokenMark[] = [];
  for (const mark of marks) {
    const from = changes.mapPos(mark.from, 1);
    const to = changes.mapPos(mark.to, -1);
    if (from < to) mapped.push({ ...mark, from, to });
  }
  return mapped;
}

/**
 * The colors to draw on the code blocks shown, from the colors read for each (`colorsOf`) and those drawn before, moved
 * with the text (`kept`): a block whose colors are read gets them, in one step; one whose new colors aren't read yet
 * keeps what it showed, so typing never shows code without colors. `uncolored` names the blocks to read.
 */
export function codeColorsAfter(
  blocks: readonly FencedCode[],
  colorsOf: (block: FencedCode) => Colored | undefined,
  kept: readonly TokenMark[],
): { marks: TokenMark[]; uncolored: FencedCode[] } {
  const marks: TokenMark[] = [];
  const uncolored: FencedCode[] = [];
  for (const block of blocks) {
    const colored = colorsOf(block);
    if (colored === undefined) uncolored.push(block);
    if (Array.isArray(colored)) marks.push(...colored.map((mark) => ({ ...mark, from: mark.from + block.from, to: mark.to + block.from })));
    else if (colored !== 'none') marks.push(...marksIn(kept, block));
  }
  return { marks, uncolored };
}

function marksIn(marks: readonly TokenMark[], block: FencedCode): TokenMark[] {
  const end = block.from + block.text.length;
  return marks.filter((mark) => mark.from >= block.from && mark.to <= end);
}
