import { describe, expect, it } from 'vitest';
import { anchorRevealStep } from './anchorReveal';

describe('anchorRevealStep', () => {
  it('shows the selection once its rows are in, until it has', () => {
    expect(anchorRevealStep(12, false)).toBe('reveal');
    expect(anchorRevealStep(12, true)).toBe('none');
  });

  it('shows it again after the filters hid every row and were cleared', () => {
    expect(anchorRevealStep(0, true)).toBe('forget');
    expect(anchorRevealStep(12, false)).toBe('reveal');
  });
});
