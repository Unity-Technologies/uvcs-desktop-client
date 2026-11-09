import { describe, expect, it } from 'vitest';
import { pressPlacesCaret } from './pressPlacement';

describe('pressPlacesCaret', () => {
  const press = { button: 0, onText: false, inBox: true, onControl: false };

  it('puts the caret where a press lands in the box but not on its text: the padding, under the last line', () => {
    expect(pressPlacesCaret(press)).toBe(true);
  });

  it('leaves the text’s own presses to the editor, and every other button’s to the window', () => {
    expect(pressPlacesCaret({ ...press, onText: true })).toBe(false);
    expect(pressPlacesCaret({ ...press, button: 2 })).toBe(false);
  });

  it('leaves a press on a control in the box to it (the toolbar, the corner button, a chip’s link), and one from a popup outside it', () => {
    expect(pressPlacesCaret({ ...press, onControl: true })).toBe(false);
    expect(pressPlacesCaret({ ...press, inBox: false })).toBe(false);
  });
});
