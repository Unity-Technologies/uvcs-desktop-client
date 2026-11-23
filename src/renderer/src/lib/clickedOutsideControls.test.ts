import { describe, expect, it } from 'vitest';
import { clickedOutsideControls, CONTROLS, type ClickTarget } from './clickedOutsideControls';

/** A target inside a control, or not: `closest` finds it only when asked for the controls. */
function target(insideControl: boolean): ClickTarget {
  return { closest: (selectors) => (insideControl && selectors === CONTROLS ? {} : null) };
}

describe('clickedOutsideControls', () => {
  it("takes a click on the row's own words, its time or its avatar", () => {
    expect(clickedOutsideControls(target(false), false)).toBe(true);
  });

  it('leaves a click on a link or a button inside the row to it', () => {
    expect(clickedOutsideControls(target(true), false)).toBe(false);
  });

  it('leaves the end of a drag selecting text alone, and a click on nothing', () => {
    expect(clickedOutsideControls(target(false), true)).toBe(false);
    expect(clickedOutsideControls(null, false)).toBe(false);
  });
});
