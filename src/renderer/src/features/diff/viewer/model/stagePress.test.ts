import { describe, expect, it } from 'vitest';
import { CLICK_SLOP, pressIsClick, pressPans } from './stagePress';

describe('pressPans', () => {
  it('pans with the right or middle button, or the left with Shift', () => {
    expect(pressPans(2, false)).toBe(true);
    expect(pressPans(1, false)).toBe(true);
    expect(pressPans(0, true)).toBe(true);
  });

  it('turns with the left button alone', () => {
    expect(pressPans(0, false)).toBe(false);
  });
});

describe('pressIsClick', () => {
  it('is a click when the left button stays put, Shift held or not', () => {
    expect(pressIsClick(0, 0)).toBe(true);
    expect(pressIsClick(0, CLICK_SLOP - 1)).toBe(true);
  });

  it('is a drag once it moves, and never a click of the other buttons', () => {
    expect(pressIsClick(0, CLICK_SLOP)).toBe(false);
    expect(pressIsClick(2, 0)).toBe(false);
    expect(pressIsClick(1, 0)).toBe(false);
  });
});
