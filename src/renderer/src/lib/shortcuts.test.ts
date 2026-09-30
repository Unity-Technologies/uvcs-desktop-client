import '../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { formatShortcut, matchesShortcut } from './shortcuts';

function press(key: string, code: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers } as KeyboardEvent;
}

describe('matchesShortcut', () => {
  it('matches a symbol typed with Shift by its character', () => {
    expect(matchesShortcut(press('?', 'Slash', { shiftKey: true }), '?')).toBe(true);
    expect(matchesShortcut(press('/', 'Slash'), '?')).toBe(false);
  });

  it('matches ⌘/ without Shift', () => {
    expect(matchesShortcut(press('/', 'Slash', { metaKey: true }), 'mod+/')).toBe(true);
    expect(matchesShortcut(press('?', 'Slash', { metaKey: true, shiftKey: true }), 'mod+/')).toBe(false);
  });

  it('names the space bar', () => {
    expect(matchesShortcut(press(' ', 'Space'), 'space')).toBe(true);
  });

  it('names the paging and edge keys, with and without modifiers', () => {
    expect(matchesShortcut(press('PageDown', 'PageDown'), 'pagedown')).toBe(true);
    expect(matchesShortcut(press('Home', 'Home', { shiftKey: true }), 'shift+home')).toBe(true);
    expect(matchesShortcut(press('Home', 'Home', { shiftKey: true }), 'home')).toBe(false);
    expect(matchesShortcut(press('ArrowLeft', 'ArrowLeft', { metaKey: true }), 'mod+left')).toBe(true);
    expect(matchesShortcut(press('ArrowLeft', 'ArrowLeft', { metaKey: true }), 'left')).toBe(false);
    expect(matchesShortcut(press(']', 'BracketRight'), ']')).toBe(true);
  });

  it('reads digits by their key position, so Shift doesn’t change them', () => {
    expect(matchesShortcut(press('!', 'Digit1', { metaKey: true, shiftKey: true }), 'mod+shift+1')).toBe(true);
    expect(matchesShortcut(press('1', 'Digit1', { metaKey: true }), 'mod+shift+1')).toBe(false);
  });
});

describe('matchesShortcut off macOS', () => {
  it('takes Ctrl for mod, never the Windows or Super key', () => {
    expect(matchesShortcut(press('k', 'KeyK', { ctrlKey: true }), 'mod+k', false)).toBe(true);
    expect(matchesShortcut(press('k', 'KeyK', { metaKey: true }), 'mod+k', false)).toBe(false);
    expect(matchesShortcut(press('k', 'KeyK', { ctrlKey: true, metaKey: true }), 'mod+k', false)).toBe(false);
  });

  it('never takes AltGr (Ctrl+Alt on Windows) for Ctrl', () => {
    expect(matchesShortcut(press('\\', 'Minus', { ctrlKey: true, altKey: true }), 'mod+\\', false)).toBe(false);
  });
});

describe('matchesShortcut on other keyboard layouts', () => {
  it('reads letters by the character the layout types: Ctrl+Z on a German keyboard is the key labelled Z', () => {
    expect(matchesShortcut(press('z', 'KeyY', { ctrlKey: true }), 'mod+z', false)).toBe(true);
    expect(matchesShortcut(press('z', 'KeyY', { ctrlKey: true }), 'mod+y', false)).toBe(false);
    expect(matchesShortcut(press('a', 'KeyQ', { metaKey: true }), 'mod+a')).toBe(true);
  });

  it('reads letters by position where the layout types no Latin letter', () => {
    expect(matchesShortcut(press('Ω', 'KeyZ', { metaKey: true, altKey: true }), 'mod+alt+z')).toBe(true);
    expect(matchesShortcut(press('л', 'KeyK', { ctrlKey: true }), 'mod+k', false)).toBe(true);
  });

  it('reads digits by position, as AZERTY types them with Shift', () => {
    expect(matchesShortcut(press('&', 'Digit1', { ctrlKey: true }), 'mod+1', false)).toBe(true);
  });
});

describe('formatShortcut', () => {
  it('shows macOS symbols in its modifier order', () => {
    expect(formatShortcut('mod+shift+k', true)).toEqual(['⇧', '⌘', 'K']);
    expect(formatShortcut('mod+alt+z', true)).toEqual(['⌥', '⌘', 'Z']);
    expect(formatShortcut('mod+enter', true)).toEqual(['⌘', '↩']);
    expect(formatShortcut('mod+backspace', true)).toEqual(['⌘', '⌫']);
  });

  it('spells chords out as one cap elsewhere, Ctrl, Alt and Shift first, never a macOS symbol', () => {
    expect(formatShortcut('mod+shift+k', false)).toEqual(['Ctrl+Shift+K']);
    expect(formatShortcut('shift+mod+enter', false)).toEqual(['Ctrl+Shift+Enter']);
    expect(formatShortcut('alt+down', false)).toEqual(['Alt+↓']);
    expect(formatShortcut('mod+shift+backspace', false)).toEqual(['Ctrl+Shift+Backspace']);
    expect(formatShortcut('delete', false)).toEqual(['Delete']);
    expect(formatShortcut('escape', false)).toEqual(['Esc']);
    expect(formatShortcut('shift+f10', false)).toEqual(['Shift+F10']);
    expect(formatShortcut('tab', false)).toEqual(['Tab']);
    expect(formatShortcut('mod+,', false)).toEqual(['Ctrl+,']);
    expect(formatShortcut('pageup', false)).toEqual(['Page Up']);
  });
});
