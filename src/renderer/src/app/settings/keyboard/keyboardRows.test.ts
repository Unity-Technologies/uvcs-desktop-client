import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { keymapOf } from '@shared/shortcuts/keymap';
import { findKey, findTakesEscape, keyboardPaneState, keyboardRows, pressOutcome, recordedKey, resetOutcome, type KeyboardRow } from './keyboardRows';

const MAC = true;
const defaults = keymapOf({}, MAC);

const VIEWS = [
  { id: 'changes', label: 'Changes', shortcut: 'mod+1' },
  { id: 'incoming', label: 'Incoming', shortcut: 'mod+2' },
];

const rowsOf = (sheet: ReturnType<typeof keyboardRows>) => sheet.flatMap(([, rows]) => rows);
const nameOf = (row: KeyboardRow) => (row.kind === 'changeable' ? row.id : row.rowKey);

describe('keyboardRows', () => {
  it('lists every shortcut, area by area, the views under Go to: every key the app shows is here', () => {
    const rows = keyboardRows(defaults, {}, VIEWS, { by: 'words', text: '' }, MAC);
    expect(rows.map(([area]) => area).slice(0, 3)).toEqual(['General', 'Go to', 'Lists']);
    const all = rowsOf(rows);
    expect(all.find((row) => nameOf(row) === 'newBranch')).toEqual({ kind: 'changeable', id: 'newBranch', label: 'New branch', keys: ['mod+b'], changed: false, removable: true });
    expect(all.find((row) => nameOf(row) === 'view:changes')).toMatchObject({ kind: 'fixed', keys: ['mod+1'], why: "Can't change: it follows the order of the sidebar." });
    expect(all.find((row) => nameOf(row) === 'textCopy')).toEqual({ kind: 'fixed', rowKey: 'textCopy', label: 'Copy', keys: ['mod+c'], why: "Can't change: it's the text editor's key." });
    // Off macOS only: the Mac has no key for it.
    expect(all.some((row) => nameOf(row) === 'appMenu')).toBe(false);
  });

  it('shows the keys a person chose, and marks the shortcuts they changed', () => {
    const custom = { newBranch: ['mod+shift+b'], commandLog: [] };
    const all = rowsOf(keyboardRows(keymapOf(custom, MAC), custom, [], { by: 'words', text: '' }, MAC));
    expect(all.find((row) => nameOf(row) === 'newBranch')).toMatchObject({ keys: ['mod+shift+b'], changed: true });
    expect(all.find((row) => nameOf(row) === 'commandLog')).toMatchObject({ keys: [], changed: true, removable: false });
  });

  it('finds shortcuts by the words of their names and areas, and by their keys as the screen writes them', () => {
    const names = (text: string) => rowsOf(keyboardRows(defaults, {}, VIEWS, { by: 'words', text }, MAC)).map(nameOf);
    expect(names('switch branch')).toEqual(['switchBranch']);
    expect(names('⇧⌘W')).toEqual(['switchBranch']);
    expect(names('incoming')).toContain('view:incoming');
  });

  it('finds every shortcut a key pressed runs, those that can\'t change too, and all while none is pressed yet', () => {
    const names = (key: string | null) => rowsOf(keyboardRows(defaults, {}, VIEWS, { by: 'key', key }, MAC)).map(nameOf);
    expect(names('alt+down')).toEqual(['nextChange', 'annotateNextBlock', 'nextConflict']);
    expect(names('mod+c')).toEqual(['listCopy', 'textCopy']);
    expect(names(null).length).toBeGreaterThan(100);
  });
});

describe('pressOutcome', () => {
  it('keeps recording after a key that is refused, and says why', () => {
    expect(pressOutcome('newBranch', { kind: 'refused', reason: 'Quits the app.' })).toEqual({ gives: false, note: { tone: 'problem', text: 'Quits the app.' }, keepsRecording: true });
  });

  it('gives a free key at once, and stops on the key it has', () => {
    expect(pressOutcome('newBranch', { kind: 'allowed', takenFrom: [], elsewhere: [] })).toEqual({ gives: true, note: null, keepsRecording: false });
    expect(pressOutcome('newBranch', { kind: 'unchanged' })).toEqual({ gives: false, note: null, keepsRecording: false });
  });

  it('asks before taking a key from other shortcuts, naming them by area where it differs', () => {
    expect(pressOutcome('newBranch', { kind: 'allowed', takenFrom: ['switchBranch'], elsewhere: [] })).toEqual({
      gives: false,
      note: { tone: 'confirm', text: 'Switch branch uses it.' },
      keepsRecording: false,
    });
    expect(pressOutcome('newBranch', { kind: 'allowed', takenFrom: ['switchBranch', 'graphMerge'], elsewhere: [] }).note).toEqual({
      tone: 'confirm',
      text: 'Switch branch and Merge from the selection (Branch Explorer) use it.',
    });
  });

  it('gives a key shortcuts of other views keep too, and names them', () => {
    expect(pressOutcome('graphMerge', { kind: 'allowed', takenFrom: [], elsewhere: ['historyToggleView'] })).toEqual({
      gives: true,
      note: { tone: 'info', text: 'Diff or annotate the revision (History) uses it too, in another view.' },
      keepsRecording: false,
    });
  });
});

describe('keyboardPaneState', () => {
  it('says why the list is empty: no name matches, or no shortcut that can change uses the keys pressed', () => {
    expect(keyboardPaneState(0, { by: 'words', text: 'zzz' }, {}).emptyText).toBe('No shortcut matches.');
    expect(keyboardPaneState(0, { by: 'key', key: 'mod+j' }, {}).emptyText).toBe('No shortcut uses these keys.');
    expect(keyboardPaneState(3, { by: 'words', text: '' }, {}).emptyText).toBeNull();
  });

  it('offers to reset all shortcuts once one was changed', () => {
    expect(keyboardPaneState(3, { by: 'words', text: '' }, {}).resetsAll).toBe(false);
    expect(keyboardPaneState(3, { by: 'words', text: '' }, { commandLog: [] }).resetsAll).toBe(true);
  });
});

describe('recordedKey', () => {
  const press = (key: string, code: string, modifiers: Partial<KeyboardEvent> = {}) => ({ key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers });

  it('records a shortcut, waits while only modifiers are held, stops on Esc and lets Tab move on', () => {
    expect(recordedKey(press('b', 'KeyB', { metaKey: true }), MAC)).toEqual({ action: 'record', key: 'mod+b' });
    expect(recordedKey(press('Meta', 'MetaLeft', { metaKey: true }), MAC)).toEqual({ action: 'wait' });
    expect(recordedKey(press('Escape', 'Escape'), MAC)).toEqual({ action: 'stop' });
    expect(recordedKey(press('Tab', 'Tab'), MAC)).toEqual({ action: 'leave' });
  });
});

describe('resetOutcome', () => {
  it('gives a shortcut its own keys back at once while no other shortcut took them', () => {
    expect(resetOutcome('newBranch', keymapOf({ newBranch: ['mod+shift+b'] }, MAC), MAC)).toEqual({ gives: true });
  });

  it('asks first when a shortcut a person gave the keys to since would lose them', () => {
    // New branch took ⇧⌘W from Switch branch; giving Switch branch its keys back takes ⇧⌘W from New branch.
    const keymap = keymapOf({ newBranch: ['mod+shift+w'], switchBranch: [] }, MAC);
    expect(resetOutcome('switchBranch', keymap, MAC)).toEqual({ gives: false, note: { tone: 'confirm', text: 'New branch uses its keys now.' } });
  });

  it('names every shortcut that took one of its keys', () => {
    // Command palette came with ⌘K and ⇧⌘P: New branch took ⌘K, Go to file ⇧⌘P.
    const keymap = keymapOf({ commandPalette: ['mod+j'], newBranch: ['mod+k'], goToFile: ['mod+shift+p'] }, MAC);
    expect(resetOutcome('commandPalette', keymap, MAC)).toEqual({ gives: false, note: { tone: 'confirm', text: 'New branch and Go to file (Files) use its keys now.' } });
  });
});

describe('findKey', () => {
  const press = (key: string, code: string, modifiers: Partial<KeyboardEvent> = {}) => ({ key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers });

  it('records the keys to find, and lets Tab move on', () => {
    expect(findKey(press('ArrowDown', 'ArrowDown', { altKey: true }), null, MAC)).toEqual({ action: 'record', key: 'alt+down' });
    expect(findKey(press('Tab', 'Tab'), null, MAC)).toEqual({ action: 'leave' });
  });

  it('empties the field on Backspace, and finds ⌘⌫ as keys', () => {
    expect(findKey(press('Backspace', 'Backspace'), 'alt+down', MAC)).toEqual({ action: 'clear' });
    expect(findKey(press('Backspace', 'Backspace', { metaKey: true }), null, MAC)).toEqual({ action: 'record', key: 'mod+backspace' });
  });

  it('empties the field on Esc, then goes back to finding by name', () => {
    expect(findKey(press('Escape', 'Escape'), 'alt+down', MAC)).toEqual({ action: 'clear' });
    expect(findKey(press('Escape', 'Escape'), null, MAC)).toEqual({ action: 'findByName' });
  });
});

describe('findTakesEscape', () => {
  it('keeps Esc in the field while it finds by keys or has words, so Settings stays open', () => {
    expect(findTakesEscape({ by: 'key', key: null })).toBe(true);
    expect(findTakesEscape({ by: 'words', text: 'branch' })).toBe(true);
    expect(findTakesEscape({ by: 'words', text: '' })).toBe(false);
  });
});
