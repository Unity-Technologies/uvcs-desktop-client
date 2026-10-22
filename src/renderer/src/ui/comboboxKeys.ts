import { navigationTarget } from '../lib/listNavigation';
import { matchesWordFilter } from '../lib/matchesAllWords';

/**
 * The options an editable combobox lists: all of them when the user asked for the list (its arrow, or ↓), else those
 * matching what they typed. A field that already holds a name (a dropped folder's) still lists everything from its arrow.
 */
export function comboboxOptionsShown(options: readonly string[], value: string, showAll: boolean): readonly string[] {
  return showAll ? options : options.filter((option) => matchesWordFilter([option], value));
}

/** The row highlighted as the full list opens: the option the field holds, so the list opens on it; none otherwise. */
export function activeOnOpen(options: readonly string[], value: string): number {
  return options.indexOf(value.trim());
}

/** What a key pressed in an editable combobox's field does. */
export type ComboboxKeyAction =
  /** Opens the full list, highlighting `active`. */
  | { kind: 'open'; active: number }
  | { kind: 'move'; to: number }
  | { kind: 'pick'; index: number }
  /** Closes the list and lets the key through (Tab moves on). */
  | { kind: 'close' }
  /** Not the combobox's: typed, or left to the form (Enter with no row highlighted submits what was typed). */
  | { kind: 'none' };

/**
 * ↓ or ↑ opens the closed list; while open they (and Page Up / Down) move through its rows, Enter picks the row
 * highlighted and Tab closes it. Typing highlights no row, so Enter keeps a new name typed rather than taking a
 * suggestion. Esc is the list's popover's own: it closes the list, not the dialog.
 */
export function comboboxKeyAction(key: string, open: boolean, active: number, shown: readonly string[], value: string): ComboboxKeyAction {
  if (!open) return key === 'ArrowDown' || key === 'ArrowUp' ? { kind: 'open', active: activeOnOpen(shown, value) } : { kind: 'none' };
  if (key === 'Tab') return { kind: 'close' };
  if (key === 'Enter') return active >= 0 && active < shown.length ? { kind: 'pick', index: active } : { kind: 'none' };
  const to = navigationTarget(key, active, shown.length);
  return to === null ? { kind: 'none' } : { kind: 'move', to };
}
