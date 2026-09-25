import { describe, expect, it } from 'vitest';
import { isInScope, parseScope } from './paletteScope';

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
