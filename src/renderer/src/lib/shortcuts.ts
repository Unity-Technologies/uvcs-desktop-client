import { isMac } from './platform';

/**
 * Shortcuts are written as `mod+shift+k`, where `mod` is ⌘ on macOS and Ctrl elsewhere, and the `+` key as `plus`.
 */
const MAC_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  enter: '↩',
  backspace: '⌫',
  delete: '⌦',
  escape: 'Esc',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  plus: '+',
};

const OTHER_NAMES: Record<string, string> = { mod: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', enter: 'Enter', plus: '+' };

export function formatShortcut(shortcut: string): string[] {
  return shortcut.split('+').map((key) => {
    const names = isMac ? MAC_SYMBOLS : OTHER_NAMES;
    return names[key] ?? (key.length === 1 ? key.toUpperCase() : capitalize(key));
  });
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const keys = shortcut.split('+');
  const key = keys.at(-1)!;
  const wantsMod = keys.includes('mod');
  const modPressed = isMac ? event.metaKey : event.ctrlKey;

  return (
    wantsMod === modPressed &&
    keys.includes('shift') === event.shiftKey &&
    keys.includes('alt') === event.altKey &&
    (isMac ? keys.includes('ctrl') === event.ctrlKey : true) &&
    normalizeKey(event) === key
  );
}

function normalizeKey(event: KeyboardEvent): string {
  if (event.code.startsWith('Digit')) return event.code.slice(5);
  if (event.code.startsWith('Key')) return event.code.slice(3).toLowerCase();
  const named: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', '+': 'plus' };
  return named[event.key] ?? event.key.toLowerCase();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
