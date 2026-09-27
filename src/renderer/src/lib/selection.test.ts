import { describe, expect, it } from 'vitest';
import { EMPTY_SELECTION, selectOnArrow, selectOnClick, successorKey } from './selection';

const keys = ['a', 'b', 'c', 'd'];
const plain = { shift: false, toggle: false };

describe('selectOnClick', () => {
  it('selects only the clicked item', () => {
    const state = selectOnClick({ selected: new Set(['a', 'b']), anchor: 'a' }, 'c', keys, plain);
    expect([...state.selected]).toEqual(['c']);
  });

  it('toggles an item without losing the others', () => {
    const state = selectOnClick({ selected: new Set(['a']), anchor: 'a' }, 'c', keys, { shift: false, toggle: true });
    expect([...state.selected]).toEqual(['a', 'c']);
  });

  it('selects the range from the anchor with shift', () => {
    const start = selectOnClick(EMPTY_SELECTION, 'b', keys, plain);
    const state = selectOnClick(start, 'd', keys, { shift: true, toggle: false });
    expect([...state.selected]).toEqual(['b', 'c', 'd']);
  });
});

describe('selectOnArrow', () => {
  it('moves down and clamps at the end', () => {
    const result = selectOnArrow(EMPTY_SELECTION, keys, 1, false, 'd');
    expect(result?.focused).toBe('d');
  });

  it('extends the selection with shift', () => {
    const result = selectOnArrow({ selected: new Set(['b']), anchor: 'b' }, keys, 1, true, 'b');
    expect([...(result?.state.selected ?? [])]).toEqual(['b', 'c']);
  });

  it('jumps a page or to either end, clamped', () => {
    expect(selectOnArrow(EMPTY_SELECTION, keys, 2, false, 'a')?.focused).toBe('c');
    expect(selectOnArrow(EMPTY_SELECTION, keys, 10, false, 'a')?.focused).toBe('d');
    expect(selectOnArrow(EMPTY_SELECTION, keys, -Infinity, false, 'c')?.focused).toBe('a');
  });

  it('extends to the end from the anchor with shift', () => {
    const result = selectOnArrow({ selected: new Set(['b']), anchor: 'b' }, keys, Infinity, true, 'b');
    expect([...(result?.state.selected ?? [])]).toEqual(['b', 'c', 'd']);
  });
});

describe('successorKey', () => {
  it('selects the row that took the place of a deleted one', () => {
    expect(successorKey(['a', 'b', 'c', 'd'], ['a', 'c', 'd'], 'b')).toBe('c');
  });

  it('skips the other rows that went with it', () => {
    expect(successorKey(['a', 'b', 'c', 'd'], ['a', 'd'], 'b')).toBe('d');
  });

  it('falls back to the row before when the last rows went', () => {
    expect(successorKey(['a', 'b', 'c', 'd'], ['a', 'b'], 'c')).toBe('b');
  });

  it('selects the first row when the gone one was never shown, e.g. kept from an earlier visit', () => {
    expect(successorKey([], ['a', 'b'], 'x')).toBe('a');
    expect(successorKey(['a', 'b'], ['a', 'b'], null)).toBe('a');
  });

  it('selects nothing when no row is left', () => {
    expect(successorKey(['a'], [], 'a')).toBeUndefined();
  });
});
