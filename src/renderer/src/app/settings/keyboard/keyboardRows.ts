import { canonicalKey, defaultKeysTakenFrom, isChanged, isCustomizable, type CustomShortcuts, type KeyChoice, type Keymap } from '@shared/shortcuts/keymap';
import { SHORTCUT_AREAS, SHORTCUTS, shortcutKeys, type ShortcutArea, type ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { matchesWordFilter } from '../../../lib/matchesAllWords';
import { formatShortcut, pressedShortcut, type PressedKey } from '../../../lib/shortcuts';

export interface KeyboardRow {
  id: ShortcutId;
  label: string;
  /** Its keys now, the binding first; none when a person removed it. */
  keys: readonly string[];
  /** It takes keys other than the app's. */
  changed: boolean;
  /** While recording, it offers to remove the shortcut: it has keys to remove. */
  removable: boolean;
}

/** What the rows are filtered by: words of their names, areas or keys, or a key pressed (Find by keys). */
export type KeyboardFilter = { by: 'words'; text: string } | { by: 'key'; key: string | null };

/**
 * Settings ▸ Keyboard's rows, area by area in the registry's order: the shortcuts a person may change, with their keys
 * now, those the filter keeps. Areas left with none are left out.
 */
export function keyboardRows(keymap: Keymap, custom: CustomShortcuts, filter: KeyboardFilter, mac: boolean): [ShortcutArea, KeyboardRow[]][] {
  const ids = (Object.keys(SHORTCUTS) as ShortcutId[]).filter(isCustomizable);
  const rows = ids
    .map((id): KeyboardRow & { area: ShortcutArea } => ({ id, area: SHORTCUTS[id].area, label: SHORTCUTS[id].label, keys: keymap[id], changed: isChanged(custom, id), removable: keymap[id].length > 0 }))
    .filter((row) => kept(row, filter, mac));
  return SHORTCUT_AREAS.map((area): [ShortcutArea, KeyboardRow[]] => [area, rows.filter((row) => row.area === area).map(({ area: _area, ...row }) => row)]).filter(
    ([, areaRows]) => areaRows.length > 0,
  );
}

function kept(row: KeyboardRow & { area: ShortcutArea }, filter: KeyboardFilter, mac: boolean): boolean {
  if (filter.by === 'key') return filter.key === null || row.keys.some((key) => canonicalKey(key) === canonicalKey(filter.key!));
  const keyTexts = row.keys.map((key) => formatShortcut(key, mac).join(''));
  return matchesWordFilter([row.label, row.area, ...keyTexts], filter.text);
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
  const emptyText = filter.by === 'key' && filter.key !== null ? 'No shortcut you can change uses these keys.' : 'No shortcut matches.';
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
 * lose them, after asking with the key they'd lose.
 */
export function resetOutcome(id: ShortcutId, keymap: Keymap, mac: boolean): { gives: true } | { gives: false; key: string; note: KeyNote } {
  const takenFrom = defaultKeysTakenFrom(id, keymap, mac);
  if (takenFrom.length === 0) return { gives: true };
  const defaults = new Set(shortcutKeys(SHORTCUTS[id], mac).map(canonicalKey));
  const key = keymap[takenFrom[0]!].find((taken) => defaults.has(canonicalKey(taken)))!;
  return { gives: false, key, note: { tone: 'confirm', text: usesIt(id, takenFrom) } };
}
