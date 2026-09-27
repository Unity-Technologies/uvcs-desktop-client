import { describe, expect, it } from 'vitest';
import { formatCount } from './text';

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(20412)).toBe('20,412');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});
