import { describe, expect, it } from 'vitest';
import { formatCount, pluralize } from './text';

describe('pluralize', () => {
  it('writes the count with thousands separators, the noun singular only for one', () => {
    expect(pluralize(1, 'file')).toBe('1 file');
    expect(pluralize(3008, 'file')).toBe('3,008 files');
    expect(pluralize(2, 'branch', 'branches')).toBe('2 branches');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});
