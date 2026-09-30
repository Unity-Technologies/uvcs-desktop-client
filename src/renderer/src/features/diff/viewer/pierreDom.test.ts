import { describe, expect, it } from 'vitest';
import { changedLineType, lineRowSelector, numberCellSelector } from './pierreDom';

describe('pierreDom', () => {
  it('names a changed line by its type in Pierre’s rows', () => {
    expect(changedLineType({ side: 'additions' })).toBe('change-addition');
    expect(changedLineType({ side: 'deletions' })).toBe('change-deletion');
  });

  it('selects a changed line’s content row and its number cell', () => {
    expect(lineRowSelector({ side: 'deletions', lineNumber: 3 })).toBe('[data-line-type="change-deletion"][data-line="3"]');
    expect(numberCellSelector({ side: 'additions', lineNumber: 12 })).toBe('[data-line-type="change-addition"][data-column-number="12"]');
  });
});
