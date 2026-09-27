import { describe, expect, it } from 'vitest';
import { isKeyboardFocusKey, isPointerReturnFocus } from './inputModality';

describe('isKeyboardFocusKey', () => {
  it("keeps the focus a click brought the pointer's through modifiers, so a Shift+click shows no focus ring", () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) expect(isKeyboardFocusKey(key)).toBe(false);
  });

  it('gives the focus back to the keyboard with any other key, whose ring then shows', () => {
    for (const key of ['Tab', 'ArrowDown', 'a', 'Escape']) expect(isKeyboardFocusKey(key)).toBe(true);
  });
});

describe('isPointerReturnFocus', () => {
  const trigger = { hasAttribute: (name: string) => name === 'aria-haspopup' };
  const button = { hasAttribute: () => false };

  it('shows no ring on a menu trigger focus comes back to after a click closed the menu', () => {
    expect(isPointerReturnFocus(trigger, 'pointer')).toBe(true);
  });

  it('shows it when the keyboard closed the menu (Esc, Enter on an item)', () => {
    expect(isPointerReturnFocus(trigger, 'keyboard')).toBe(false);
  });

  it('leaves every other focus to the browser', () => {
    expect(isPointerReturnFocus(button, 'pointer')).toBe(false);
  });
});
