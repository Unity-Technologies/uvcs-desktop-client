import { describe, expect, it } from 'vitest';
import { compareCmVersions } from './cmRuntime';

describe('compareCmVersions', () => {
  it('compares number by number, not as text', () => {
    expect(compareCmVersions('11.0.16.9876', '11.0.16.10659')).toBeLessThan(0);
    expect(compareCmVersions('11.0.16.10659', '11.0.16.10659')).toBe(0);
    expect(compareCmVersions('12.0.0.1', '11.9.99.99999')).toBeGreaterThan(0);
  });
});
