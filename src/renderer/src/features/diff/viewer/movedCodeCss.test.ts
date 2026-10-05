import { describe, expect, it } from 'vitest';
import type { MovedBlock } from './movedBlocks';
import { linesOf, movedCodeCss } from './movedCodeCss';

/** Lines 3–5 of the original moved to 20–22, line 4 edited on the way (21 in the modified file). */
const MOVE: MovedBlock = {
  deletions: { start: 3, count: 3 },
  additions: { start: 20, count: 3 },
  changed: [
    { side: 'deletions', lineNumber: 4 },
    { side: 'additions', lineNumber: 21 },
  ],
  replaced: [{ deletion: 4, addition: 21 }],
};

const EDITED = 'linear-gradient(var(--diff-moved-edited),var(--diff-moved-edited))';
const EMPHASIS = 'linear-gradient(var(--diff-moved-emphasis),var(--diff-moved-emphasis))';

const rule = (css: string, declaration: string): string => css.split('\n').find((line) => line.endsWith(`{${declaration}}`)) ?? '';

describe('movedCodeCss', () => {
  it('styles nothing in a diff with no moves', () => {
    expect(movedCodeCss([], undefined)).toBe('');
  });

  it('gives the moved color to every line of the move, in both places, edited ones too', () => {
    const css = movedCodeCss([MOVE], undefined);
    const removed = rule(css, '--diffs-deletion-base:var(--change-moved)');
    const added = rule(css, '--diffs-addition-base:var(--change-moved)');
    for (const line of [3, 4, 5]) expect(removed).toContain(`[data-line-type="change-deletion"][data-line="${line}"]`);
    for (const line of [20, 21, 22]) expect(added).toContain(`[data-line-type="change-addition"][data-column-number="${line}"]`);
  });

  it('tints the lines changed on the way a little stronger, so they stand out in the move without breaking it up', () => {
    const edited = rule(movedCodeCss([MOVE], undefined), `background-image:${EDITED}`);
    expect(edited).toContain('[data-line-type="change-deletion"][data-line="4"]');
    expect(edited).toContain('[data-line-type="change-addition"][data-line="21"]');
    for (const line of [3, 5]) expect(edited).not.toContain(`[data-line="${line}"]`);
  });

  it("drops Pierre's word marks from every moved line, edited ones too: they compare it with an unrelated line", () => {
    const unmarked = rule(movedCodeCss([MOVE], undefined), 'background:none');
    for (const line of [3, 4, 5]) expect(unmarked).toContain(`[data-line-type="change-deletion"][data-line="${line}"]`);
    for (const line of [20, 21, 22]) expect(unmarked).toContain(`[data-line-type="change-addition"][data-line="${line}"]`);
  });

  it('lights up every line of the move under the pointer, in both places, its edited lines staying stronger', () => {
    const css = movedCodeCss([MOVE], MOVE);
    const lit = rule(css, `background-image:${EMPHASIS}`);
    const litEdited = rule(css, `background-image:${EMPHASIS},${EDITED}`);
    for (const line of [3, 5]) expect(lit).toContain(`[data-line-type="change-deletion"][data-line="${line}"]`);
    for (const line of [20, 22]) expect(lit).toContain(`[data-line-type="change-addition"][data-line="${line}"]`);
    expect(litEdited).toContain('[data-line-type="change-deletion"][data-line="4"]');
    expect(litEdited).toContain('[data-line-type="change-addition"][data-line="21"]');
    expect(movedCodeCss([MOVE], undefined)).not.toContain('--diff-moved-emphasis');
  });
});

describe('linesOf', () => {
  it("lists a move's lines in one of its places", () => {
    expect(linesOf(MOVE, 'additions')).toEqual([
      { side: 'additions', lineNumber: 20 },
      { side: 'additions', lineNumber: 21 },
      { side: 'additions', lineNumber: 22 },
    ]);
  });
});
