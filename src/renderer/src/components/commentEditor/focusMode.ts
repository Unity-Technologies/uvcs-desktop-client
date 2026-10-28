import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { SHORTCUTS, shortcutKeys } from '../../lib/shortcutRegistry';

/**
 * Focus mode (docs/features/rich-comments.md, "Writing"): a comment of many lines grows into a large editor over
 * the view, or within the dialog it's in, and back. It is the same editor, its text, caret and selection kept.
 */
export function offersFocusMode(singleLine: boolean): boolean {
  return !singleLine;
}

/**
 * How the larger editor shows: over the view, the rest dimmed behind it; in a dialog, the field grows in place, as
 * the dialog keeps the focus and the clicks within it (one outside would close it).
 */
export function focusModeLayout(inDialog: boolean): 'overlay' | 'inPlace' {
  return inDialog ? 'inPlace' : 'overlay';
}

/**
 * What a key does to focus mode: its shortcut goes in and out (`toggle`), Esc out (`collapse`), once the
 * suggestions are closed; null leaves the key to the text.
 */
export function focusModeKey(event: PressedKey, mac: boolean, state: { expanded: boolean; suggesting: boolean }): 'toggle' | 'collapse' | null {
  if (shortcutKeys(SHORTCUTS.commentFocusMode, mac).some((key) => matchesShortcut(event, key, mac))) return 'toggle';
  if (event.key === 'Escape' && state.expanded && !state.suggesting) return 'collapse';
  return null;
}
