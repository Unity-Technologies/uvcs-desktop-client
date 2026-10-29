import { describe, expect, it } from 'vitest';
import { hintsThatFit } from './hintsThatFit';

describe('hintsThatFit', () => {
  // Hints of 120, 70 and 60 px, in their order of priority, 16 px apart.
  const widths = [120, 70, 60];

  it('keeps them all on one line when there’s room', () => {
    expect(hintsThatFit(widths, 16, 120 + 16 + 70 + 16 + 60)).toBe(3);
  });

  it('drops the lowest-priority hints, from the last, rather than wrap', () => {
    expect(hintsThatFit(widths, 16, 120 + 16 + 70 + 16 + 59)).toBe(2);
    expect(hintsThatFit(widths, 16, 150)).toBe(1);
  });

  it('keeps none when not even the first fits, and keeps them all before the width is known', () => {
    expect(hintsThatFit(widths, 16, 100)).toBe(0);
    expect(hintsThatFit(widths, 16, null)).toBe(3);
  });
});
