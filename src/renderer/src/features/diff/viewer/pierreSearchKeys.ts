import { resolveEditorCommandFromKeyboardEvent, type EditorCommand, type EditorKeymap, type EditorShortcut } from '@pierre/diffs/edit';
import { isMac } from '../../../lib/platform';
import { SHORTCUTS, shortcutKeys, type ShortcutId } from '../../../lib/shortcutRegistry';

/** The editor commands that open a search, by the registry's keys for them, so the keys the menus and the sheet show open it. */
const SEARCH_COMMANDS: Record<'find' | 'replace', { registryId: ShortcutId; command: EditorCommand }> = {
  find: { registryId: 'textFind', command: 'openSearchPanel' },
  replace: { registryId: 'textReplace', command: 'openSearchReplacePanel' },
};

/**
 * The keys of Pierre's editor (1.6.2) that differ from its own (`dist/editor/command.js`): Replace on the registry's key,
 * Ctrl+H off macOS, where Ctrl+Alt+F is AltGr+F on European layouts. Pierre checks these before its own (its
 * Ctrl+Alt+F stays), so `searchKeyMode` reads the registry's keys and Pierre's alike as the keys that open a search.
 */
export function pierreEditorKeymap(mac = isMac): EditorKeymap {
  const bindings = Object.fromEntries(Object.values(SEARCH_COMMANDS).map(({ registryId, command }) => [pierreShortcut(keyOf(registryId, mac)), command]));
  return [{ bindings }];
}

/**
 * What a key that reaches the code does to the search: opens it (`find`, `replace`); types its character, kept from
 * Pierre's editor, which would open its own search panel from it (`type`); or nothing to do with the search (null).
 */
export type SearchKey = 'find' | 'replace' | 'type' | null;

/**
 * Whether a key opens a search (`find`) or a search that replaces (`replace`), and so the app's (`useCodeFind`), as
 * Pierre's editor reads it with the app's keymap: the registry's keys and Pierre's own (its Ctrl+Alt+F). The code takes
 * such a key before Pierre's editor does, so Pierre never opens a search panel of its own and every side of a diff has
 * the one search. AltGr typing a character is `type`: Windows sends AltGr as Ctrl+Alt, and Pierre, which falls back
 * from the key to the physical one, reads AltGr+F, `[` on a Czech or Hungarian layout, as its Ctrl+Alt+F. Null for any
 * other key and for a key typed while composing (an IME's). `pierreMac` is the platform as Pierre reads it
 * (`pierreReadsMac`).
 */
export function searchKeyMode(event: KeyboardEvent, mac = isMac, pierreMac = pierreReadsMac()): SearchKey {
  if (event.isComposing) return null;
  const command = resolveEditorCommandFromKeyboardEvent(event, appKeymap(mac), pierreMac);
  if (command !== 'openSearchPanel' && command !== 'openSearchReplacePanel') return null;
  if (typesCharacter(event)) return 'type';
  return command === 'openSearchPanel' ? 'find' : 'replace';
}

/**
 * Whether Pierre's editor reads a key as a command although it types a character: AltGr (Ctrl+Alt, never with ⌘)
 * giving a character other than the letter pressed.
 */
export function typesCharacter(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  if (!event.ctrlKey || !event.altKey || event.metaKey || event.key.length !== 1) return false;
  return event.code !== `Key${event.key.toUpperCase()}`;
}

/** The app's keymap for each platform, made once: Pierre compiles a keymap once per array it's given. */
const APP_KEYMAPS = new Map<boolean, EditorKeymap>();

function appKeymap(mac: boolean): EditorKeymap {
  const known = APP_KEYMAPS.get(mac);
  if (known) return known;
  const keymap = pierreEditorKeymap(mac);
  APP_KEYMAPS.set(mac, keymap);
  return keymap;
}

/**
 * Whether Pierre's editor takes the platform as macOS, by its own rule (`isMacLike` in `dist/utils/platform.js`, which
 * Pierre doesn't export): it reads the browser's platform, never the app's preview of another OS.
 */
export function pierreReadsMac(platform: string = globalThis.navigator?.platform ?? 'unknown'): boolean {
  return /macOS|MacIntel|iPhone|iPad|iPod/i.test(platform);
}

function keyOf(id: ShortcutId, mac: boolean): string {
  return shortcutKeys(SHORTCUTS[id], mac)[0]!;
}

/** A registry key (`mod+alt+f`) as Pierre's keymap writes it (`cmdOrCtrl+alt+f`). */
export function pierreShortcut(key: string): EditorShortcut {
  return key
    .split('+')
    .map((part) => (part === 'mod' ? 'cmdOrCtrl' : part))
    .join('+') as EditorShortcut;
}
