import { isMac } from './platform';

/**
 * Shortcuts are written as `mod+shift+k`, where `mod` is ⌘ on macOS and Ctrl elsewhere, and the `+` key as `plus`.
 * macOS shows them as symbols in its own modifier order (⌃⌥⇧⌘K); Windows and Linux spell them out (Ctrl+Alt+Shift+K).
 */
const MAC_NAMES: Record<string, string> = {
  mod: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  enter: '↩',
  backspace: '⌫',
  delete: '⌦',
  tab: '⇥',
};

const OTHER_NAMES: Record<string, string> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
};

const SHARED_NAMES: Record<string, string> = {
  escape: 'Esc',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  plus: '+',
  pageup: 'Page Up',
  pagedown: 'Page Down',
};

const MAC_MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'mod'];
const OTHER_MODIFIER_ORDER = ['mod', 'ctrl', 'alt', 'shift'];

/** The key caps of a shortcut: one per key on macOS (⇧, ⌘, K), one for the whole chord elsewhere (Ctrl+Shift+K). */
export function formatShortcut(shortcut: string, mac = isMac): string[] {
  const keys = shortcut.split('+');
  const key = keys.at(-1)!;
  const order = mac ? MAC_MODIFIER_ORDER : OTHER_MODIFIER_ORDER;
  const modifiers = keys.slice(0, -1).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const names = [...modifiers, key].map((part) => keyName(part, mac));
  return mac ? names : [names.join('+')];
}

function keyName(key: string, mac: boolean): string {
  const name = (mac ? MAC_NAMES : OTHER_NAMES)[key] ?? SHARED_NAMES[key];
  return name ?? (key.length === 1 ? key.toUpperCase() : capitalize(key));
}

/** Whether the shortcut modifier is held: ⌘ on macOS, Ctrl elsewhere. */
export function isModPressed(event: Pick<KeyboardEvent | MouseEvent, 'metaKey' | 'ctrlKey'>, mac = isMac): boolean {
  return mac ? event.metaKey : event.ctrlKey;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string, mac = isMac): boolean {
  const keys = shortcut.split('+');
  const key = keys.at(-1)!;

  // A symbol typed with Shift (`?`, `+`) is matched by the character, whatever Shift took to type it.
  const shiftMatters = !SHIFTED_SYMBOLS.has(key);

  return (
    keys.includes('mod') === isModPressed(event, mac) &&
    (!shiftMatters || keys.includes('shift') === event.shiftKey) &&
    keys.includes('alt') === event.altKey &&
    // ⌃ is a modifier of its own on macOS; elsewhere the Windows or Super key never takes part in a shortcut.
    (mac ? keys.includes('ctrl') === event.ctrlKey : !event.metaKey) &&
    normalizeKey(event) === key
  );
}

const SHIFTED_SYMBOLS = new Set(['?', 'plus']);

/**
 * Letters go by the character the layout types (Ctrl+Z is the key labelled Z on a German or French keyboard too),
 * or by their position where it types none (⌥ turns them into symbols on macOS; Cyrillic and other scripts); digits
 * always by position, so Shift (or an AZERTY layout, which needs Shift to type them) doesn't change them.
 */
function normalizeKey(event: KeyboardEvent): string {
  if (event.code.startsWith('Digit')) return event.code.slice(5);
  if (/^[a-z]$/i.test(event.key)) return event.key.toLowerCase();
  if (event.code.startsWith('Key')) return event.code.slice(3).toLowerCase();
  const named: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', '+': 'plus', ' ': 'space' };
  return named[event.key] ?? event.key.toLowerCase();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
