import { describe, expect, it } from 'vitest';
import { compactFilter } from './compactFilter';

describe('compactFilter', () => {
  it('drops the fields that ask for nothing', () => {
    expect(compactFilter({ sinceDate: undefined, owners: [], includeHidden: false, text: '' })).toEqual({});
  });

  it('keeps the ones that filter', () => {
    expect(compactFilter({ sinceDate: '2026-01-01', owners: ['me'], includeHidden: true, limit: 10 })).toEqual({
      sinceDate: '2026-01-01',
      owners: ['me'],
      includeHidden: true,
      limit: 10,
    });
  });
});
