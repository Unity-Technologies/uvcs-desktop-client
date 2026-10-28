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
export function focusModeLayout(inDialog: boolean): FocusModeLayout {
  return inDialog ? 'inPlace' : 'overlay';
}

/**
 * What a key does to focus mode: its shortcut goes in and out (`toggle`), Esc out (`collapse`), once the
 * suggestions are closed, and ⌘↵ out as it goes on to save (`submitting`); null leaves the key to the text.
 */
export function focusModeKey(event: PressedKey, mac: boolean, state: { expanded: boolean; suggesting: boolean }): 'toggle' | 'collapse' | 'submitting' | null {
  if (shortcutKeys(SHORTCUTS.commentFocusMode, mac).some((key) => matchesShortcut(event, key, mac))) return 'toggle';
  // ⌘↵ saves or checks in: the field closes the larger editor, the key going on to do its work.
  if (state.expanded && shortcutKeys(SHORTCUTS.saveComment, mac).some((key) => matchesShortcut(event, key, mac))) return 'submitting';
  if (event.key === 'Escape' && state.expanded && !state.suggesting) return 'collapse';
  return null;
}

export type FocusModeLayout = 'overlay' | 'inPlace';

/** The larger editor stays only while it has the focus: a dialog it opened (a check-in's question) or Tab leaves it. */
export function layoutAfterFocus(layout: FocusModeLayout | null, focused: boolean): FocusModeLayout | null {
  return focused ? layout : null;
}

/** The corner button: what it does, its icon, and whether the larger editor is open (`aria-pressed`). */
export function focusModeButton(layout: FocusModeLayout | null): { label: string; icon: 'expand' | 'collapse'; pressed: boolean } {
  return layout ? { label: 'Back to the field', icon: 'collapse', pressed: true } : { label: 'Write in a larger editor', icon: 'expand', pressed: false };
}
