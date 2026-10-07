import { describe, expect, it } from 'vitest';
import { navBadgeText } from './navBadgeText';

describe('navBadgeText', () => {
  it('writes counts up to 999 whole on a wide row, and more as 999+', () => {
    expect(navBadgeText({ count: 7 }, false)).toBe('7');
    expect(navBadgeText({ count: 999 }, false)).toBe('999');
    expect(navBadgeText({ count: 1000 }, false)).toBe('999+');
  });

  it('writes counts up to 99 whole on the rail, and more as 99+', () => {
    expect(navBadgeText({ count: 99 }, true)).toBe('99');
    expect(navBadgeText({ count: 100 }, true)).toBe('99+');
    expect(navBadgeText({ count: 123456 }, true)).toBe('99+');
  });

  it('writes a count that stopped short with a plus, within the same caps', () => {
    expect(navBadgeText({ count: 100, more: true }, false)).toBe('100+');
    expect(navBadgeText({ count: 100, more: true }, true)).toBe('99+');
    expect(navBadgeText({ count: 12, more: true }, true)).toBe('12+');
  });
});
