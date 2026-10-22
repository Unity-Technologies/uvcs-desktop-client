import { navigationTarget } from '../lib/listNavigation';
import { matchesWordFilter } from '../lib/matchesAllWords';

/** What an editable combobox's list is doing: open or not, listing all options or those typed, and the row highlighted. */
export interface ComboboxState {
  open: boolean;
  /** The user asked for the list (its arrow, or ↓): it lists every option whatever the field holds. */
  showAll: boolean;
  /** The row highlighted; -1 for none. */
  active: number;
}

export const COMBOBOX_CLOSED: ComboboxState = { open: false, showAll: false, active: -1 };

/** The options the list shows: all of them when the user asked for the list, else those matching what they typed. */
export function comboboxShown(showAll: boolean, options: readonly string[], value: string): readonly string[] {
  return showAll ? options : options.filter((option) => matchesWordFilter([option], value));
}

/** Whether the list is on screen: open, with something to show, in a field that can change. */
export function comboboxListed(state: ComboboxState, shownCount: number, readOnly: boolean): boolean {
  return state.open && !readOnly && shownCount > 0;
}

/** The full list, opened on the option the field holds (none highlighted for a name not listed). */
function openedOnValue(options: readonly string[], value: string): ComboboxState {
  return { open: true, showAll: true, active: options.indexOf(value.trim()) };
}

/**
 * Typing lists the options matching it, highlighting none, so Enter keeps a new name as typed. It opens the list even
 * before the options are read: they show as they arrive, while the user is still typing.
 */
export function afterTyping(): ComboboxState {
  return { open: true, showAll: false, active: -1 };
}

/** The arrow closes the list on screen, or opens the full one; a field with no options has nothing to open. */
export function afterArrowClick(listed: boolean, options: readonly string[], value: string): ComboboxState {
  if (listed || options.length === 0) return COMBOBOX_CLOSED;
  return openedOnValue(options, value);
}

export interface ComboboxKeyPress {
  key: string;
  /** Ctrl or ⌘ held: the key is a shortcut, not the combobox's. Alt isn't: Alt+↓ is the usual way to open a combobox. */
  withShortcutModifier: boolean;
  /** The key ends or edits an input method's composition (Japanese, Chinese…): it's the input method's. */
  composing: boolean;
}

/** What a key does: the next state, whether the combobox took the key (so it goes no further), and the option picked. */
export interface ComboboxKeyResult {
  state: ComboboxState;
  handled: boolean;
  picked?: string;
}

/**
 * ↓ or ↑ opens the full list on the option the field holds; while the list shows, they (and Page Up / Down) move
 * through its rows, Enter picks the row highlighted and Tab closes it. Enter with no row highlighted, and every other
 * key, is left to the field and its form: Enter then submits what was typed. Esc is the list's popover's own: it closes
 * the list, not the dialog.
 */
export function afterKey(state: ComboboxState, press: ComboboxKeyPress, options: readonly string[], value: string, readOnly: boolean): ComboboxKeyResult {
  const unhandled = { state, handled: false };
  if (readOnly || press.composing || press.withShortcutModifier) return unhandled;
  const shown = comboboxShown(state.showAll, options, value);
  if (!comboboxListed(state, shown.length, readOnly)) {
    const opens = (press.key === 'ArrowDown' || press.key === 'ArrowUp') && options.length > 0;
    return opens ? { state: openedOnValue(options, value), handled: true } : unhandled;
  }
  if (press.key === 'Tab') return { state: COMBOBOX_CLOSED, handled: false };
  if (press.key === 'Enter') {
    const picked = shown[state.active];
    return picked === undefined ? unhandled : { state: COMBOBOX_CLOSED, handled: true, picked };
  }
  const to = navigationTarget(press.key, state.active, shown.length);
  return to === null ? unhandled : { state: { ...state, active: to }, handled: true };
}
