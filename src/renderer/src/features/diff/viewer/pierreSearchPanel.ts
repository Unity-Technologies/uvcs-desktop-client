import type { EditorCommand, EditorKeymap, EditorShortcut } from '@pierre/diffs/edit';
import { isMac } from '../../../lib/platform';
import { SHORTCUTS, shortcutKeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import { pierreShadowRoot } from './pierreDom';

/** How Pierre's search panel opens: to find, or to find and replace. */
export type SearchPanelMode = 'find' | 'replace';

/** The editor commands the app's registry names keys for, so the editor takes the keys the menus and the sheet show. */
const SEARCH_COMMANDS: Record<SearchPanelMode, { registryId: ShortcutId; command: EditorCommand }> = {
  find: { registryId: 'textFind', command: 'openSearchPanel' },
  replace: { registryId: 'textReplace', command: 'openSearchReplacePanel' },
};

/**
 * The keys of Pierre's editor (1.6.1) that differ from its own (`dist/editor/command.js`): Replace on the registry's key,
 * Ctrl+H off macOS, where Pierre's Ctrl+Alt+F is AltGr+F on European layouts. Pierre checks these before its own, so
 * its Ctrl+Alt+F still works; only the keys shown change.
 */
export function pierreEditorKeymap(mac = isMac): EditorKeymap {
  const bindings = Object.fromEntries(Object.values(SEARCH_COMMANDS).map(({ registryId, command }) => [pierreShortcut(keyOf(registryId, mac)), command]));
  return [{ bindings }];
}

/**
 * Opens Pierre's search panel over the text typed into in `container`, in find or replace mode. Pierre 1.6.1's `Editor`
 * has no public way to: its keymap runs `openSearchPanel` or `openSearchReplacePanel`, which reach the private
 * `#openSearchPanel(mode)`, from a keydown on its content element (`contenteditable`, in the `diffs-container`'s shadow
 * root). So the menu presses the key that opens it, the one the registry shows (`pierreEditorKeymap`), on that element.
 * Whether that key reaches the command is checked through Pierre's own resolver (`resolveEditorCommandFromKeyboardEvent`,
 * `pierreSearchPanel.test.ts`); that the panel opens, on screen. False when there's no editor to open it in.
 */
export function openPierreSearchPanel(container: Element | null, mode: SearchPanelMode): boolean {
  const content = pierreShadowRoot(container)?.querySelector('[contenteditable]:not([contenteditable="false"])');
  if (!(content instanceof HTMLElement)) return false;
  // Not bubbling: Pierre listens on the element itself, and the app's own shortcuts mustn't see the key.
  content.dispatchEvent(new KeyboardEvent('keydown', { ...searchPanelKey(mode), bubbles: false, cancelable: true }));
  return true;
}

/**
 * The key that opens the search panel in `mode`, as a keydown's fields: the registry's key for the app's platform
 * (`mac`, what the menu shows), its `mod` held as Pierre reads it (`pierreMac`). They differ only when a Mac previews
 * another OS (`UVCS_RENDERER_PLATFORM`): Pierre still takes `cmdOrCtrl` as ⌘ there.
 */
export function searchPanelKey(mode: SearchPanelMode, mac = isMac, pierreMac = pierreReadsMac()): KeyboardEventInit {
  return keyEventOf(keyOf(SEARCH_COMMANDS[mode].registryId, mac), pierreMac);
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

/** A registry key of one letter and its modifiers as the keydown fields a press of it has, `mod` as ⌘ where `mac`. */
function keyEventOf(key: string, mac: boolean): KeyboardEventInit {
  const parts = key.split('+');
  const letter = parts.at(-1)!;
  const held = (modifier: string): boolean => parts.slice(0, -1).includes(modifier);
  return {
    key: letter,
    code: `Key${letter.toUpperCase()}`,
    metaKey: mac && held('mod'),
    ctrlKey: (!mac && held('mod')) || held('ctrl'),
    altKey: held('alt'),
    shiftKey: held('shift'),
  };
}
