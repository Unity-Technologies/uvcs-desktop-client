import '../../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../../../lib/shortcuts';
import { flyDirectionOf, flyMoveOf } from './flyKeys';

const press = (key: string, modifiers: Partial<PressedKey> = {}): PressedKey => ({
  key,
  code: key.startsWith('Arrow') ? key : `Key${key.toUpperCase()}`,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('flyDirectionOf', () => {
  it('moves with W, A, S, D, Q and E as in Unity, and with the arrows', () => {
    expect(['w', 's', 'a', 'd', 'e', 'q'].map((key) => flyDirectionOf(press(key), true))).toEqual(['forward', 'back', 'left', 'right', 'up', 'down']);
    expect(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map((key) => flyDirectionOf(press(key), false))).toEqual(['forward', 'back', 'left', 'right']);
    expect(flyDirectionOf(press('f'), true)).toBeNull();
  });

  it("reads a keyboard event's keys, which are getters of its prototype, as the browser's are", () => {
    class BrowserKeyEvent {
      get key() {
        return 's';
      }
      get code() {
        return 'KeyS';
      }
      get metaKey() {
        return false;
      }
      get ctrlKey() {
        return false;
      }
      get altKey() {
        return false;
      }
      get shiftKey() {
        return true;
      }
    }
    expect(flyDirectionOf(new BrowserKeyEvent(), true)).toBe('back');
  });

  it('moves with Shift held too (faster), and leaves keys held with ⌘, Ctrl or Alt to the window', () => {
    expect(flyDirectionOf(press('W', { shiftKey: true }), true)).toBe('forward');
    expect(flyDirectionOf(press('w', { metaKey: true }), true)).toBeNull();
    expect(flyDirectionOf(press('s', { ctrlKey: true }), false)).toBeNull();
    expect(flyDirectionOf(press('a', { altKey: true }), false)).toBeNull();
  });
});

describe('flyMoveOf', () => {
  it('moves along each axis held, opposite keys cancelling out', () => {
    expect(flyMoveOf(['forward', 'right'])).toEqual({ forward: 1, right: 1, up: 0 });
    expect(flyMoveOf(['left', 'right', 'down'])).toEqual({ forward: 0, right: 0, up: -1 });
    expect(flyMoveOf([])).toEqual({ forward: 0, right: 0, up: 0 });
  });
});
