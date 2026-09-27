import { describe, expect, it } from 'vitest';
import { AltTap } from './altTap';

const key = (key: string, modifiers: { ctrlKey?: boolean; shiftKey?: boolean; repeat?: boolean } = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  ...modifiers,
});

describe('AltTap', () => {
  it('takes Alt pressed and released alone as a tap, held down or not', () => {
    const tap = new AltTap();
    tap.keyDown(key('Alt'));
    tap.keyDown(key('Alt', { repeat: true }));
    expect(tap.keyUp(key('Alt'))).toBe(true);
  });

  it('ignores Alt held for a chord', () => {
    const tap = new AltTap();
    tap.keyDown(key('Alt'));
    tap.keyDown(key('ArrowLeft'));
    expect(tap.keyUp(key('Alt'))).toBe(false);
  });

  it('ignores Alt held for a click', () => {
    const tap = new AltTap();
    tap.keyDown(key('Alt'));
    tap.cancel();
    expect(tap.keyUp(key('Alt'))).toBe(false);
  });

  it('ignores AltGr, which reaches the page as Ctrl+Alt, and Alt+Shift, which switches keyboard layouts', () => {
    const tap = new AltTap();
    tap.keyDown(key('Control', { ctrlKey: true }));
    tap.keyDown(key('Alt', { ctrlKey: true }));
    expect(tap.keyUp(key('Alt'))).toBe(false);
    tap.keyDown(key('Alt'));
    tap.keyDown(key('Shift', { shiftKey: true }));
    expect(tap.keyUp(key('Alt'))).toBe(false);
  });

  it('never takes a release without its press', () => {
    expect(new AltTap().keyUp(key('Alt'))).toBe(false);
  });
});
