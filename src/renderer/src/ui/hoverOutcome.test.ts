import { describe, expect, it } from 'vitest';
import { hoverOutcome } from './hoverOutcome';

const button = { id: 'apply' };
const icon = { id: 'other' };

describe('hoverOutcome', () => {
  it('keeps the tooltip still while the pointer moves over the parts of the element showing it', () => {
    expect(hoverOutcome({ shownHost: button, hoveredHost: button, allowsHover: true })).toBe('keep');
  });

  it('shows the tooltip of an element after the pointer rests on it', () => {
    expect(hoverOutcome({ shownHost: null, hoveredHost: button, allowsHover: true })).toBe('show');
    expect(hoverOutcome({ shownHost: icon, hoveredHost: button, allowsHover: true })).toBe('show');
  });

  it('hides the tooltip over what has none', () => {
    expect(hoverOutcome({ shownHost: button, hoveredHost: null, allowsHover: true })).toBe('hide');
  });

  it('hides it while the keyboard is driving, even over the element that showed it', () => {
    expect(hoverOutcome({ shownHost: button, hoveredHost: button, allowsHover: false })).toBe('hide');
  });
});
