import { describe, expect, it } from 'vitest';
import { rowsPerPage, selectionStep } from './tableKeys';

const press = (key: string, modifiers: Partial<Record<'altKey' | 'metaKey' | 'ctrlKey' | 'shiftKey', boolean>> = {}) => ({
  key,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('selectionStep', () => {
  const options = { pageRows: 20, letterMoves: false };

  it('moves a row with the arrows, a page with PageUp and PageDown, and to the ends with Home and End', () => {
    expect(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].map((key) => selectionStep(press(key), options))).toEqual([
      1, -1, 20, -20, -Infinity, Infinity,
    ]);
  });

  it('still moves with Shift, which extends the selection', () => {
    expect(selectionStep(press('ArrowDown', { shiftKey: true }), options)).toBe(1);
  });

  it("leaves ⌥↑ and ⌥↓ to the diff beside the list, and other keys to the table's owner", () => {
    expect(selectionStep(press('ArrowDown', { altKey: true }), options)).toBeUndefined();
    expect(selectionStep(press('ArrowLeft'), options)).toBeUndefined();
    expect(selectionStep(press('Enter'), options)).toBeUndefined();
  });

  it('moves with J and K only in lists read one row after another, and only unmodified', () => {
    expect(selectionStep(press('j'), options)).toBeUndefined();
    const letters = { ...options, letterMoves: true };
    expect([selectionStep(press('j'), letters), selectionStep(press('k'), letters)]).toEqual([1, -1]);
    expect(selectionStep(press('j', { metaKey: true }), letters)).toBeUndefined();
    expect(selectionStep(press('k', { shiftKey: true }), letters)).toBeUndefined();
  });
});

describe('rowsPerPage', () => {
  it('moves a viewport of rows less one, so the row moved from stays in view', () => {
    expect(rowsPerPage(600, 30)).toBe(19);
    expect(rowsPerPage(610, 30)).toBe(19);
  });

  it('moves at least one row, even before the viewport is measured', () => {
    expect(rowsPerPage(0, 30)).toBe(1);
    expect(rowsPerPage(40, 30)).toBe(1);
  });
});
