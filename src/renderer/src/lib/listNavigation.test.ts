import { describe, expect, it } from 'vitest';
import { navigationTarget } from './listNavigation';

describe('navigationTarget', () => {
  it('moves one row with the arrows, stopping at the ends', () => {
    expect(navigationTarget('ArrowDown', 0, 3)).toBe(1);
    expect(navigationTarget('ArrowDown', 2, 3)).toBe(2);
    expect(navigationTarget('ArrowUp', 0, 3)).toBe(0);
  });

  it('jumps a page at a time', () => {
    expect(navigationTarget('PageDown', 0, 30)).toBe(10);
    expect(navigationTarget('PageDown', 25, 30)).toBe(29);
    expect(navigationTarget('PageUp', 5, 30)).toBe(0);
  });

  it('ignores other keys and empty lists', () => {
    expect(navigationTarget('a', 0, 3)).toBeNull();
    expect(navigationTarget('ArrowDown', 0, 0)).toBeNull();
  });
});
