import { describe, expect, it } from 'vitest';
import { flashCss } from '../../diff/viewer/lineMarksCss';
import { conflictLinesSelector, conflictsAbove } from './conflictRows';

describe('conflictsAbove', () => {
  it('counts the conflicts starting above the top of the view; one starting at the top is in view', () => {
    expect(conflictsAbove([10, 200, 900], 0)).toBe(0);
    expect(conflictsAbove([-400, 200, 900], 200)).toBe(1);
    expect(conflictsAbove([-400, -20, -1], 0)).toBe(3);
    expect(conflictsAbove([], 0)).toBe(0);
  });
});

describe('conflictLinesSelector', () => {
  it("selects a conflict's lines by their index, so both sides light up", () => {
    expect(conflictLinesSelector(['2,2', '3,2'])).toBe('[data-line-index="2,2"],[data-line-index="3,2"]');
    expect(flashCss(conflictLinesSelector(['2,2']), 1)).toContain('[data-line-index="2,2"]{animation:change-flash-1 ');
  });

  it('lights nothing for a conflict with no lines on screen', () => {
    expect(flashCss(conflictLinesSelector([]), 1)).toBe('');
  });
});
