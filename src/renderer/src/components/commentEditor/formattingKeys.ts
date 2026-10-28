import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { SHORTCUTS, shortcutKeys } from '../../lib/shortcutRegistry';
import { FORMAT_ACTIONS } from './formatActions';
import type { FormatCommandId } from './formatCommands';

/**
 * The format a key press runs, matched as the window's shortcuts are (`matchesShortcut`: letters by the character
 * typed, digits by their place), so the registry decides the editor's keys as it does every other. `formats` are
 * the ones the field offers: a one-line field takes no block.
 */
export function formatForKey(event: PressedKey, formats: readonly FormatCommandId[], mac: boolean): FormatCommandId | null {
  for (const { id, shortcutId } of FORMAT_ACTIONS) {
    if (formats.includes(id) && shortcutId && shortcutKeys(SHORTCUTS[shortcutId], mac).some((key) => matchesShortcut(event, key, mac))) return id;
  }
  return null;
}

/** Whether the key pastes without formatting (⇧⌘V): the clipboard's plain text, as typed. */
export function pastesPlain(event: PressedKey, mac: boolean): boolean {
  return shortcutKeys(SHORTCUTS.commentPastePlain, mac).some((key) => matchesShortcut(event, key, mac));
}
