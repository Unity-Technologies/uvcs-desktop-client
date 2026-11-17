import { describe, expect, it } from 'vitest';
import { singleSelection } from '../../lib/selection';
import { anchorRevealStep, selectionSetWhileHidden } from './anchorReveal';

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

describe('selectionSetWhileHidden', () => {
  const left = singleSelection('lock:a.png');

  it('is a selection made while the view was hidden: Show in Locks into the Locks view kept mounted', () => {
    expect(selectionSetWhileHidden(left, singleSelection('lock:b.png'))).toBe(true);
  });

  it('is one made for the row already selected too, after the user scrolled it away', () => {
    expect(selectionSetWhileHidden(left, singleSelection('lock:a.png'))).toBe(true);
  });

  it('is nothing when the view shows again as it was left, or was never hidden', () => {
    expect(selectionSetWhileHidden(left, left)).toBe(false);
    expect(selectionSetWhileHidden(undefined, left)).toBe(false);
  });
});
