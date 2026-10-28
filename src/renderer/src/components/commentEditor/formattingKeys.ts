import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { SHORTCUTS, shortcutKeys, type ShortcutId } from '../../lib/shortcutRegistry';
import type { FormatCommandId } from './formatCommands';

/** Each format's shortcut in the registry, where the shortcuts sheet lists it. A task list has none, as in Slack. */
export const FORMAT_SHORTCUTS: Partial<Record<FormatCommandId, ShortcutId>> = {
  bold: 'commentBold',
  italic: 'commentItalic',
  strikethrough: 'commentStrikethrough',
  code: 'commentCode',
  link: 'commentLink',
  bullet: 'commentList',
  quote: 'commentQuote',
  codeBlock: 'commentCodeBlock',
};

/**
 * The format a key press runs, matched as the window's shortcuts are (`matchesShortcut`: letters by the character
 * typed, digits by their place), so the registry decides the editor's keys as it does every other. `formats` are
 * the ones the field offers: a one-line field takes no block.
 */
export function formatForKey(event: PressedKey, formats: readonly FormatCommandId[], mac: boolean): FormatCommandId | null {
  for (const format of formats) {
    const id = FORMAT_SHORTCUTS[format];
    if (id && shortcutKeys(SHORTCUTS[id], mac).some((key) => matchesShortcut(event, key, mac))) return format;
  }
  return null;
}

/** Whether the key pastes without formatting (⇧⌘V): the clipboard's plain text, as typed. */
export function pastesPlain(event: PressedKey, mac: boolean): boolean {
  return shortcutKeys(SHORTCUTS.commentPastePlain, mac).some((key) => matchesShortcut(event, key, mac));
}
