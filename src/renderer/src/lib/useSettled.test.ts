import { describe, expect, it } from 'vitest';
import { settleDelay } from './useSettled';

describe('settleDelay', () => {
  it('shows a change after a pause at once', () => {
    expect(settleDelay(1000, -Infinity, 300)).toBe(0);
    expect(settleDelay(1000, 700, 300)).toBe(0);
  });

  it('waits the full delay for a change that follows another quickly, as arrowing through rows does', () => {
    expect(settleDelay(1000, 950, 300)).toBe(300);
  });
});
