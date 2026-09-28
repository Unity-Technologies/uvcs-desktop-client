import { describe, expect, it } from 'vitest';
import { formatCount, pluralize, shownCount } from './text';

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(20412)).toBe('20,412');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});

describe('pluralize', () => {
  it('writes the count with thousands separators, the noun singular only for one', () => {
    expect(pluralize(1, 'file')).toBe('1 file');
    expect(pluralize(3008, 'file')).toBe('3,008 files');
    expect(pluralize(2, 'branch', 'branches')).toBe('2 branches');
  });
});

describe('shownCount', () => {
  it('counts what shows, and of how many once filters hide some', () => {
    expect(shownCount(340)).toBe('340');
    expect(shownCount(340, 340)).toBe('340');
    expect(shownCount(12, 1340)).toBe('12 of 1,340');
  });
});
