import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { keymapOf } from '@shared/shortcuts/keymap';
import { keyboardPaneState, keyboardRows, pressOutcome, recordedKey, resetOutcome } from './keyboardRows';

const MAC = true;
const defaults = keymapOf({}, MAC);

describe('keyboardRows', () => {
  it('lists only the shortcuts a person may change, area by area', () => {
    const rows = keyboardRows(defaults, {}, { by: 'words', text: '' }, MAC);
    expect(rows.map(([area]) => area)).toEqual(['General', 'Lists', 'Changes', 'Diff', 'Branch Explorer', 'Files', 'History', 'Merge']);
    const general = rows.find(([area]) => area === 'General')![1];
    expect(general.find((row) => row.id === 'newBranch')).toEqual({ id: 'newBranch', label: 'New branch', keys: ['mod+b'], changed: false, removable: true });
    expect(rows.flatMap(([, areaRows]) => areaRows).some((row) => row.id === 'textCopy')).toBe(false);
  });

  it('shows the keys a person chose, and marks the shortcuts they changed', () => {
    const custom = { newBranch: ['mod+shift+b'], commandLog: [] };
    const general = keyboardRows(keymapOf(custom, MAC), custom, { by: 'words', text: '' }, MAC)[0]![1];
    expect(general.find((row) => row.id === 'newBranch')).toMatchObject({ keys: ['mod+shift+b'], changed: true });
    expect(general.find((row) => row.id === 'commandLog')).toMatchObject({ keys: [], changed: true, removable: false });
  });

  it('finds shortcuts by the words of their names and areas, and by their keys as the screen writes them', () => {
    const ids = (text: string) => keyboardRows(defaults, {}, { by: 'words', text }, MAC).flatMap(([, rows]) => rows.map((row) => row.id));
    expect(ids('new branch')).toEqual(['newBranch']);
    expect(ids('⇧⌘W')).toEqual(['switchBranch']);
    expect(ids('history')).toEqual(['fileHistory', 'historyToggleView']);
  });

  it('finds the shortcuts a key pressed runs, all of them while none is pressed yet', () => {
    const ids = (key: string | null) => keyboardRows(defaults, {}, { by: 'key', key }, MAC).flatMap(([, rows]) => rows.map((row) => row.id));
    expect(ids('alt+down')).toEqual(['nextChange', 'nextConflict']);
    expect(ids('shift+mod+p')).toEqual(['commandPalette']);
    expect(ids(null).length).toBeGreaterThan(30);
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
    expect(keyboardPaneState(0, { by: 'key', key: 'mod+c' }, {}).emptyText).toBe('No shortcut you can change uses these keys.');
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
    expect(resetOutcome('commandPalette', keymap, MAC)).toEqual({ gives: false, note: { tone: 'confirm', text: 'New branch and Go to file use its keys now.' } });
  });
});
