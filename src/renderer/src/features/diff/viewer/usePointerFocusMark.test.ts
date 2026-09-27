import { describe, expect, it } from 'vitest';
import { isKeyboardFocusKey } from './usePointerFocusMark';

describe('isKeyboardFocusKey', () => {
  it("keeps the focus a click brought the pointer's through modifiers, so a Shift+click shows no focus ring", () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) expect(isKeyboardFocusKey(key)).toBe(false);
  });

  it('gives the focus back to the keyboard with any other key, whose ring then shows', () => {
    for (const key of ['Tab', 'ArrowDown', 'a', 'Escape']) expect(isKeyboardFocusKey(key)).toBe(true);
  });
});
