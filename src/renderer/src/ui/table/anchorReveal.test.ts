import { describe, expect, it } from 'vitest';
import { anchorChangedWhileHidden, anchorRevealStep } from './anchorReveal';

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

describe('anchorChangedWhileHidden', () => {
  it('is the selection made while the view was hidden: Show in Locks into the Locks view kept mounted', () => {
    expect(anchorChangedWhileHidden('lock:a.png', 'lock:b.png')).toBe(true);
    expect(anchorChangedWhileHidden(null, 'lock:b.png')).toBe(true);
  });

  it("is nothing when the view shows again as it was left, or was never hidden", () => {
    expect(anchorChangedWhileHidden('lock:a.png', 'lock:a.png')).toBe(false);
    expect(anchorChangedWhileHidden(undefined, 'lock:a.png')).toBe(false);
  });
});
