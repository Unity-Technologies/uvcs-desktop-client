import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../lib/shortcuts';
import { formatForKey, pastesPlain } from './formattingKeys';
import type { FormatCommandId } from './formatCommands';

const EVERY: FormatCommandId[] = ['bold', 'italic', 'strikethrough', 'code', 'link', 'bullet', 'task', 'quote', 'codeBlock'];
const INLINE: FormatCommandId[] = ['bold', 'italic', 'strikethrough', 'code', 'link'];

function press(key: string, code: string, modifiers: Partial<PressedKey> = {}): PressedKey {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe('formatForKey', () => {
  it("takes Slack's keys on macOS", () => {
    expect(formatForKey(press('b', 'KeyB', { metaKey: true }), EVERY, true)).toBe('bold');
    expect(formatForKey(press('i', 'KeyI', { metaKey: true }), EVERY, true)).toBe('italic');
    expect(formatForKey(press('x', 'KeyX', { metaKey: true, shiftKey: true }), EVERY, true)).toBe('strikethrough');
    expect(formatForKey(press('e', 'KeyE', { metaKey: true }), EVERY, true)).toBe('code');
    expect(formatForKey(press('k', 'KeyK', { metaKey: true }), EVERY, true)).toBe('link');
    // Shift turns 8 into *, and 9 into (: digits go by their place.
    expect(formatForKey(press('*', 'Digit8', { metaKey: true, shiftKey: true }), EVERY, true)).toBe('bullet');
    expect(formatForKey(press('(', 'Digit9', { metaKey: true, shiftKey: true }), EVERY, true)).toBe('quote');
    // ⌥ turns C into ç on macOS: the letter goes by its place then.
    expect(formatForKey(press('Ç', 'KeyC', { metaKey: true, altKey: true, shiftKey: true }), EVERY, true)).toBe('codeBlock');
  });

  it('takes Ctrl on Windows and Linux, and never Ctrl+Alt, which is AltGr there', () => {
    expect(formatForKey(press('b', 'KeyB', { ctrlKey: true }), EVERY, false)).toBe('bold');
    expect(formatForKey(press('E', 'KeyE', { ctrlKey: true, shiftKey: true }), EVERY, false)).toBe('codeBlock');
    expect(formatForKey(press('C', 'KeyC', { ctrlKey: true, altKey: true, shiftKey: true }), EVERY, false)).toBeNull();
  });

  it('leaves the blocks to a field of many lines', () => {
    expect(formatForKey(press('*', 'Digit8', { metaKey: true, shiftKey: true }), INLINE, true)).toBeNull();
    expect(formatForKey(press('b', 'KeyB', { metaKey: true }), INLINE, true)).toBe('bold');
  });

  it('leaves other keys alone', () => {
    expect(formatForKey(press('b', 'KeyB'), EVERY, true)).toBeNull();
    expect(formatForKey(press('z', 'KeyZ', { metaKey: true }), EVERY, true)).toBeNull();
  });
});

describe('pastesPlain', () => {
  it('is ⇧⌘V, or Ctrl+Shift+V', () => {
    expect(pastesPlain(press('v', 'KeyV', { metaKey: true, shiftKey: true }), true)).toBe(true);
    expect(pastesPlain(press('v', 'KeyV', { ctrlKey: true, shiftKey: true }), false)).toBe(true);
    expect(pastesPlain(press('v', 'KeyV', { metaKey: true }), true)).toBe(false);
  });
});
