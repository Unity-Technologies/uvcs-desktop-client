import { describe, expect, it } from 'vitest';
import { foldedCut, isCut } from './foldedCut';

describe('isCut', () => {
  it('is cut when the content runs past the clamped height', () => {
    expect(isCut({ scrollHeight: 200, clientHeight: 93 })).toBe(true);
  });

  it('is whole when the content overflows only by rounding', () => {
    expect(isCut({ scrollHeight: 95, clientHeight: 93 })).toBe(false);
    expect(isCut({ scrollHeight: 93, clientHeight: 93 })).toBe(false);
  });

  it('is whole when there is no element (no description)', () => {
    expect(isCut(null)).toBe(false);
  });
});

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
