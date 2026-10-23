import { describe, expect, it } from 'vitest';
import { pickFilterItems } from './pickFilterItems';

describe('pickFilterItems', () => {
  it('lists the choice that filters nothing first, then every choice', () => {
    expect(pickFilterItems(['Racing', 'Puzzle'], '')).toEqual([
      { kind: 'all' },
      { kind: 'choice', choice: 'Racing' },
      { kind: 'choice', choice: 'Puzzle' },
    ]);
  });

  it('lists only the choices found while searching', () => {
    expect(pickFilterItems(['Racing'], 'rac')).toEqual([{ kind: 'choice', choice: 'Racing' }]);
    expect(pickFilterItems([], 'zzz')).toEqual([]);
  });

  it('keeps the choice that filters nothing for a blank search', () => {
    expect(pickFilterItems([], '  ')).toEqual([{ kind: 'all' }]);
  });
});
