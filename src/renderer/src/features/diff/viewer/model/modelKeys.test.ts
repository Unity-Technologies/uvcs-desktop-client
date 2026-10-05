import '../../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../../../lib/shortcuts';
import { modelCommandOf } from './modelKeys';

const press = (key: string, modifiers: Partial<PressedKey> = {}): PressedKey => ({
  key,
  code: /^\d$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('modelCommandOf', () => {
  it('frames with F, as in Unity, and the whole model with 0', () => {
    expect(['f', '0', 'g'].map((key) => modelCommandOf(press(key), true))).toEqual(['frame', 'frameAll', null]);
  });

  it("leaves keys held with ⌘, Ctrl or Alt to the window", () => {
    expect(modelCommandOf(press('f', { metaKey: true }), true)).toBeNull();
    expect(modelCommandOf(press('0', { ctrlKey: true }), false)).toBeNull();
  });
});
