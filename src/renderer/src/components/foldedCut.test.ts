import { describe, expect, it } from 'vitest';
import { foldedCut } from './foldedCut';

describe('foldedCut', () => {
  const whole = { title: false, description: false };

  it('takes what the measure found cut', () => {
    expect(foldedCut(whole, { title: false, description: true })).toEqual({ title: false, description: true });
  });

  it('keeps a part cut once expanded, when it no longer overflows', () => {
    expect(foldedCut({ title: true, description: true }, whole)).toEqual({ title: true, description: true });
  });

  it('gives back the same state when nothing changed', () => {
    const current = { title: true, description: false };
    expect(foldedCut(current, { title: true, description: false })).toBe(current);
    expect(foldedCut(whole, whole)).toBe(whole);
  });
});
