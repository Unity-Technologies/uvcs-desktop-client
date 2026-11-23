import { describe, expect, it } from 'vitest';
import { clickedOutsideControls, type ClickTarget } from './clickedOutsideControls';

/** A click's target inside these elements, outermost first, matched as `Element.closest` matches a list of selectors. */
function inside(...tags: string[]): ClickTarget {
  return {
    closest: (selectors) => {
      const wanted = selectors.split(',').map((selector) => selector.trim());
      return tags.find((tag) => wanted.includes(tag)) ?? null;
    },
  };
}

describe('clickedOutsideControls', () => {
  it("takes a click on the row's own words, its time or its avatar", () => {
    expect(clickedOutsideControls(inside('div', 'time'), false)).toBe(true);
    expect(clickedOutsideControls(inside('div', 'span'), false)).toBe(true);
  });

  it("leaves a click on a changeset's link, a pill's button or anything acting as a button to it", () => {
    expect(clickedOutsideControls(inside('div', 'a', 'span'), false)).toBe(false);
    expect(clickedOutsideControls(inside('div', 'button', 'svg'), false)).toBe(false);
    expect(clickedOutsideControls(inside('div', '[role="button"]'), false)).toBe(false);
  });

  it('leaves the end of a drag selecting text alone, and a click on nothing', () => {
    expect(clickedOutsideControls(inside('div'), true)).toBe(false);
    expect(clickedOutsideControls(null, false)).toBe(false);
  });
});
