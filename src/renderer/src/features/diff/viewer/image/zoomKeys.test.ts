import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../../../lib/shortcuts';
import { zoomCommandOf } from './zoomKeys';

/** A key as a US layout types it: digits by their position. */
const press = (key: string, modifiers: Partial<PressedKey> = {}): PressedKey => ({
  key,
  code: /^\d$/.test(key) ? `Digit${key}` : '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: key === '+',
  ...modifiers,
});

describe('zoomCommandOf', () => {
  it('steps the zoom with + or = and −, fits with 0 and shows 100% with 1', () => {
    expect(['+', '=', '-', '0', '1', 'a'].map((key) => zoomCommandOf(press(key), true))).toEqual(['zoomIn', 'zoomIn', 'zoomOut', 'zoomToFit', 'zoomToActualSize', null]);
  });

  it('takes + however it is typed: with Shift on a US keyboard, on a key of its own elsewhere', () => {
    expect(zoomCommandOf(press('+', { shiftKey: false }), false)).toBe('zoomIn');
  });

  it('leaves keys held with ⌘, Ctrl or Alt to the window: ⌘1 goes to the first view', () => {
    expect(zoomCommandOf(press('1', { metaKey: true }), true)).toBeNull();
    expect(zoomCommandOf(press('0', { ctrlKey: true }), false)).toBeNull();
    expect(zoomCommandOf(press('-', { altKey: true }), true)).toBeNull();
  });
});
