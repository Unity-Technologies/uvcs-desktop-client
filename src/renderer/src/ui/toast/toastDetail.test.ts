import { describe, expect, it } from 'vitest';
import { autoDismissMsOf, detailToggleOf } from './toastDetail';
import { AUTO_DISMISS_MS } from './toastStore';

describe('detailToggleOf', () => {
  it('offers no toggle when the whole detail fits in the folded lines', () => {
    expect(detailToggleOf(false, false)).toBeNull();
  });

  it('offers to show more when the folded detail hides some of its text', () => {
    expect(detailToggleOf(true, false)).toBe('Show more');
  });

  it('offers to show less once the detail is unfolded', () => {
    expect(detailToggleOf(true, true)).toBe('Show less');
  });
});

describe('autoDismissMsOf', () => {
  it('counts down as its kind does while the detail is folded', () => {
    expect(autoDismissMsOf('error', false)).toBe(AUTO_DISMISS_MS.error);
    expect(autoDismissMsOf('progress', false)).toBeNull();
  });

  it('keeps a toast the user unfolded to read until they dismiss it', () => {
    expect(autoDismissMsOf('error', true)).toBeNull();
    expect(autoDismissMsOf('success', true)).toBeNull();
  });
});
