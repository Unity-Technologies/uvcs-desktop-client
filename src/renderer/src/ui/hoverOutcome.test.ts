import { describe, expect, it } from 'vitest';
import { hoverOutcome } from './hoverOutcome';

const button = { id: 'apply' };
const otherButton = { id: 'more' };

describe('hoverOutcome', () => {
  it('keeps the tooltip still while the pointer moves over the parts of the element showing it', () => {
    expect(hoverOutcome({ shownHost: button, hoveredHost: button, allowsHover: true })).toBe('keep');
  });

  it('shows the tooltip of an element after the pointer rests on it', () => {
    expect(hoverOutcome({ shownHost: null, hoveredHost: button, allowsHover: true })).toBe('show');
  });

  it("gives another element's tooltip way to this one's after the pointer rests on it", () => {
    expect(hoverOutcome({ shownHost: otherButton, hoveredHost: button, allowsHover: true })).toBe('show');
  });

  it('hides the tooltip over what has none', () => {
    expect(hoverOutcome({ shownHost: button, hoveredHost: null, allowsHover: true })).toBe('hide');
  });

  it('hides it while the keyboard is driving, even over the element that showed it', () => {
    expect(hoverOutcome({ shownHost: button, hoveredHost: button, allowsHover: false })).toBe('hide');
  });
});
