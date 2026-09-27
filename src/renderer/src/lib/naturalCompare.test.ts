import { describe, expect, it } from 'vitest';
import { compareSortValues, naturalCompare } from './naturalCompare';

describe('naturalCompare', () => {
  it('orders numbers inside names by their value', () => {
    expect(['bulk-10', 'bulk-2', 'bulk-1'].sort(naturalCompare)).toEqual(['bulk-1', 'bulk-2', 'bulk-10']);
  });

  it('ignores case', () => {
    expect(['Zeta', 'alpha', 'Beta'].sort(naturalCompare)).toEqual(['alpha', 'Beta', 'Zeta']);
  });
});

describe('compareSortValues', () => {
  it('orders a column of names as people read them', () => {
    expect(['/main/Task-10', '/main/task-9', '/main/Alpha'].sort(compareSortValues)).toEqual(['/main/Alpha', '/main/task-9', '/main/Task-10']);
  });

  it('orders numbers by value', () => {
    expect([10, 9, 100].sort(compareSortValues)).toEqual([9, 10, 100]);
  });

  it('keeps dates in time order', () => {
    const dates = ['2026-09-27T11:31:05', '2025-12-01T09:00:00', '2026-09-27T09:59:59'];
    expect([...dates].sort(compareSortValues)).toEqual([...dates].sort());
  });
});
