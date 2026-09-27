import { describe, expect, it } from 'vitest';
import { isInScope, isSearching, parseScope } from './paletteScope';

describe('parseScope', () => {
  it('searches everything without a prefix', () => {
    expect(parseScope('  main ')).toEqual({ scope: 'all', text: 'main' });
  });

  it('narrows the search after a prefix', () => {
    expect(parseScope('>switch')).toEqual({ scope: 'commands', text: 'switch' });
    expect(parseScope('@ main')).toEqual({ scope: 'refs', text: 'main' });
    expect(parseScope('/Player.cs')).toEqual({ scope: 'files', text: 'Player.cs' });
    expect(parseScope('#1234')).toEqual({ scope: 'changesets', text: '1234' });
  });

  it('lists the whole scope for a bare prefix', () => {
    expect(parseScope('#')).toEqual({ scope: 'changesets', text: '' });
  });
});

describe('isInScope', () => {
  it('keeps branches and labels together', () => {
    expect(isInScope('labels', 'refs')).toBe(true);
    expect(isInScope('files', 'refs')).toBe(false);
    expect(isInScope('files', 'all')).toBe(true);
  });
});

describe('isSearching', () => {
  const loads = [
    { section: 'commands' as const, waiting: false },
    { section: 'branches' as const, waiting: true },
    { section: 'files' as const, waiting: false },
  ];

  it('waits for any section still loading or searching', () => {
    expect(isSearching(loads, 'all')).toBe(true);
    expect(isSearching(loads, 'refs')).toBe(true);
  });

  it('answers at once when only sections out of scope wait, so `>` never says "Searching…"', () => {
    expect(isSearching(loads, 'commands')).toBe(false);
    expect(isSearching(loads, 'files')).toBe(false);
  });
});
