import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { keymapOf } from '@shared/shortcuts/keymap';
import { keyboardRows, pressOutcome } from './keyboardRows';

const MAC = true;
const defaults = keymapOf({}, MAC);

describe('keyboardRows', () => {
  it('lists only the shortcuts a person may change, area by area', () => {
    const rows = keyboardRows(defaults, {}, { by: 'words', text: '' }, MAC);
    expect(rows.map(([area]) => area)).toEqual(['General', 'Lists', 'Changes', 'Diff', 'Branch Explorer', 'Files', 'History', 'Merge']);
    const general = rows.find(([area]) => area === 'General')![1];
    expect(general.find((row) => row.id === 'newBranch')).toEqual({ id: 'newBranch', label: 'New branch', keys: ['mod+b'], changed: false });
    expect(rows.flatMap(([, areaRows]) => areaRows).some((row) => row.id === 'textCopy')).toBe(false);
  });

  it('shows the keys a person chose, and marks the shortcuts they changed', () => {
    const custom = { newBranch: ['mod+shift+b'], commandLog: [] };
    const general = keyboardRows(keymapOf(custom, MAC), custom, { by: 'words', text: '' }, MAC)[0]![1];
    expect(general.find((row) => row.id === 'newBranch')).toMatchObject({ keys: ['mod+shift+b'], changed: true });
    expect(general.find((row) => row.id === 'commandLog')).toMatchObject({ keys: [], changed: true });
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
