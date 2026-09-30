import { describe, expect, it } from 'vitest';
import { navBadgeText } from './navBadgeText';

describe('navBadgeText', () => {
  it('writes counts up to 999 whole on a wide row, and more as 999+', () => {
    expect(navBadgeText(7, false)).toBe('7');
    expect(navBadgeText(999, false)).toBe('999');
    expect(navBadgeText(1000, false)).toBe('999+');
  });

  it('writes counts up to 99 whole on the rail, and more as 99+', () => {
    expect(navBadgeText(99, true)).toBe('99');
    expect(navBadgeText(100, true)).toBe('99+');
    expect(navBadgeText(123456, true)).toBe('99+');
  });
});
