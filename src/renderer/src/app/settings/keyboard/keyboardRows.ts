import { canonicalKey, defaultKeysTakenFrom, isChanged, isCustomizable, type CustomShortcuts, type KeyChoice, type Keymap } from '@shared/shortcuts/keymap';
import { SHORTCUT_AREAS, SHORTCUTS, type FixedReason, type ShortcutArea, type ShortcutDefinition, type ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { matchesWordFilter } from '../../../lib/matchesAllWords';
import { formatShortcut, pressedShortcut, type PressedKey } from '../../../lib/shortcuts';

/** A shortcut a person may change: its keys are a button that records new ones. */
export interface ChangeableRow {
  kind: 'changeable';
  id: ShortcutId;
  label: string;
  /** Its keys now, the binding first; none when a person removed it. */
  keys: readonly string[];
  /** It takes keys other than the app's. */
  changed: boolean;
  /** While recording, it offers to remove the shortcut: it has keys to remove. */
  removable: boolean;
}

/** A shortcut that stays as it is: listed with its keys, and why it can't change (`fixed`). */
export interface FixedRow {
  kind: 'fixed';
  /** Its id, or the view's for the views' keys. */
  rowKey: string;
  label: string;
  keys: readonly string[];
  why: string;
}

export type KeyboardRow = ChangeableRow | FixedRow;

/** What the rows are filtered by: words of their names, areas or keys, or a key pressed (Find by keys). */
export type KeyboardFilter = { by: 'words'; text: string } | { by: 'key'; key: string | null };

const WHY_FIXED: Readonly<Record<FixedReason | 'views', string>> = {
  shared: "Can't change: every app uses this key.",
  text: "Can't change: it's the text editor's key.",
  focus: "Can't change: it moves through what has the focus.",
  views: "Can't change: it follows the order of the sidebar.",
};

/**
 * Settings ▸ Keyboard's rows, area by area in the registry's order, the views' keys under Go to: every shortcut with
 * keys on this OS (or a person's, removed), those the filter keeps, so every key the app shows is here. Areas left
 * with none are left out.
 */
export function keyboardRows(
  keymap: Keymap,
  custom: CustomShortcuts,
  views: readonly { id: string; label: string; shortcut: string }[],
  filter: KeyboardFilter,
  mac: boolean,
): [ShortcutArea, KeyboardRow[]][] {
  const rows = new Map<ShortcutArea, KeyboardRow[]>(SHORTCUT_AREAS.map((area) => [area, []]));
  rows.set(
    'Go to',
    views.map((view): FixedRow => ({ kind: 'fixed', rowKey: `view:${view.id}`, label: view.label, keys: [view.shortcut], why: WHY_FIXED.views })),
  );
  for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
    const shortcut: ShortcutDefinition = SHORTCUTS[id];
    if (isCustomizable(id)) {
      rows.get(shortcut.area)!.push({ kind: 'changeable', id, label: shortcut.label, keys: keymap[id], changed: isChanged(custom, id), removable: keymap[id].length > 0 });
    } else if (keymap[id].length > 0) {
      rows.get(shortcut.area)!.push({ kind: 'fixed', rowKey: id, label: shortcut.label, keys: keymap[id], why: WHY_FIXED[shortcut.fixed ?? 'shared'] });
    }
  }
  return [...rows]
    .map(([area, areaRows]): [ShortcutArea, KeyboardRow[]] => [area, areaRows.filter((row) => matchesFilter(row.label, area, row.keys, filter, mac))])
    .filter(([, areaRows]) => areaRows.length > 0);
}

/**
 * Whether a shortcut is one the filter keeps: one of its keys is the key pressed, or the words are in its name, its
 * area or its keys as the screen writes them (⇧⌘W). Settings ▸ Keyboard's and the shortcuts sheet's.
 */
export function matchesFilter(label: string, area: string, keys: readonly string[], filter: KeyboardFilter, mac: boolean): boolean {
  if (filter.by === 'key') return filter.key === null || keys.some((key) => canonicalKey(key) === canonicalKey(filter.key!));
  const keyTexts = keys.map((key) => formatShortcut(key, mac).join(''));
  return matchesWordFilter([label, area, ...keyTexts], filter.text);
}

/** What a row says after a key is pressed for it, and whether it waits for a "Use it here". */
export type KeyNote = { tone: 'problem'; text: string } | { tone: 'confirm'; text: string } | { tone: 'info'; text: string };

/**
 * What a key pressed for shortcut `id` does: whether the shortcut takes it at once (`gives`), the note its row shows,
 * and whether the row keeps recording, for other keys after one that can't be used.
 */
export interface PressOutcome {
  gives: boolean;
  note: KeyNote | null;
  keepsRecording: boolean;
}

export function pressOutcome(id: ShortcutId, choice: KeyChoice): PressOutcome {
  const note = keyNote(id, choice);
  return { gives: choice.kind === 'allowed' && note?.tone !== 'confirm', note, keepsRecording: choice.kind === 'refused' };
}

/** The note for a key pressed for shortcut `id`: why it can't take it, whom it takes it from, or who keeps it too. */
function keyNote(id: ShortcutId, choice: KeyChoice): KeyNote | null {
  if (choice.kind === 'refused') return { tone: 'problem', text: choice.reason };
  if (choice.kind === 'unchanged') return null;
  if (choice.takenFrom.length > 0) return { tone: 'confirm', text: usesIt(id, choice.takenFrom) };
  if (choice.elsewhere.length > 0) return { tone: 'info', text: `${shortcutNames(id, choice.elsewhere)} ${choice.elsewhere.length > 1 ? 'use' : 'uses'} it too, in another view.` };
  return null;
}

function usesIt(id: ShortcutId, others: readonly ShortcutId[]): string {
  return `${shortcutNames(id, others)} ${others.length > 1 ? 'use' : 'uses'} it.`;
}

/** "Switch branch", or "Merge from the selection (Branch Explorer)" for one of an area other than `id`'s. */
function shortcutNames(id: ShortcutId, others: readonly ShortcutId[]): string {
  const names = others.map((other) => (SHORTCUTS[other].area === SHORTCUTS[id].area ? SHORTCUTS[other].label : `${SHORTCUTS[other].label} (${SHORTCUTS[other].area})`));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]!;
}

/** What the list says when no row is left, and whether Reset all shortcuts shows (something was changed). */
export function keyboardPaneState(rowCount: number, filter: KeyboardFilter, custom: CustomShortcuts): { emptyText: string | null; resetsAll: boolean } {
  const emptyText = filter.by === 'key' && filter.key !== null ? 'No shortcut uses these keys.' : 'No shortcut matches.';
  return { emptyText: rowCount === 0 ? emptyText : null, resetsAll: Object.keys(custom).length > 0 };
}

/**
 * What a key pressed does while keys are recorded (a row's keys, or Find by keys): Tab leaves, letting the focus move;
 * Esc stops; modifiers alone wait for the key they modify; any other key is recorded.
 */
export type RecordedKey = { action: 'leave' } | { action: 'stop' } | { action: 'wait' } | { action: 'record'; key: string };

export function recordedKey(event: PressedKey, mac: boolean): RecordedKey {
  if (event.key === 'Tab') return { action: 'leave' };
  if (event.key === 'Escape') return { action: 'stop' };
  const key = pressedShortcut(event, mac);
  return key === undefined ? { action: 'wait' } : { action: 'record', key };
}

/**
 * What giving a shortcut its own keys back does: at once, or, when shortcuts a person gave those keys to since would
 * lose them, after asking, naming them.
 */
export function resetOutcome(id: ShortcutId, keymap: Keymap, mac: boolean): { gives: true } | { gives: false; note: KeyNote } {
  const takenFrom = defaultKeysTakenFrom(id, keymap, mac);
  if (takenFrom.length === 0) return { gives: true };
  return { gives: false, note: { tone: 'confirm', text: `${shortcutNames(id, takenFrom)} ${takenFrom.length > 1 ? 'use' : 'uses'} its keys now.` } };
}

/**
 * What a key pressed in the find field does while it finds by keys: it's recorded as the keys to find; Backspace
 * empties the field; Esc empties it, then goes back to finding by name, never closing Settings (`findTakesEscape`);
 * Tab moves on.
 */
export type FindKey = { action: 'record'; key: string } | { action: 'clear' } | { action: 'findByName' } | { action: 'leave' } | { action: 'wait' };

export function findKey(event: PressedKey, keyFound: string | null, mac: boolean): FindKey {
  // Backspace alone empties the field, as in any text field: no shortcut a person can change is a plain Backspace.
  if (event.key === 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) return { action: 'clear' };
  const pressed = recordedKey(event, mac);
  if (pressed.action === 'stop') return keyFound === null ? { action: 'findByName' } : { action: 'clear' };
  return pressed;
}

/** Whether Esc in the find field is its own, not the dialog's: while it finds by keys, or has words to clear. */
export function findTakesEscape(filter: KeyboardFilter): boolean {
  return filter.by === 'key' || filter.text !== '';
}
