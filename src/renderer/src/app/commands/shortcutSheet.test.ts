import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { keymapOf } from '@shared/shortcuts/keymap';
import { shortcutSheet } from './shortcutSheet';

const views = [
  { label: 'Changes', shortcut: 'mod+1' },
  { label: 'Incoming', shortcut: 'mod+2' },
];

const rowOf = (sheet: ReturnType<typeof shortcutSheet>, label: string) => sheet.flatMap(([, rows]) => rows).find((row) => row.label === label);

describe('shortcutSheet', () => {
  it('lists the views under Go to, in sidebar order, after the areas before it', () => {
    const sheet = shortcutSheet(views, keymapOf({}, true));
    expect(sheet.map(([area]) => area).slice(0, 3)).toEqual(['General', 'Go to', 'Lists']);
    expect(sheet[1]).toEqual([
      'Go to',
      [
        { label: 'Changes', keys: ['mod+1'] },
        { label: 'Incoming', keys: ['mod+2'] },
      ],
    ]);
    expect(rowOf(sheet, 'Command palette')).toEqual({ label: 'Command palette', keys: ['mod+k', 'mod+shift+p'] });
  });

  it("shows each shortcut's keys on this OS, and leaves out those it doesn't have", () => {
    expect(rowOf(shortcutSheet([], keymapOf({}, true)), 'Back')).toEqual({ label: 'Back', keys: ['mod+['] });
    expect(rowOf(shortcutSheet([], keymapOf({}, true)), 'Open the menu')).toBeUndefined();
    expect(rowOf(shortcutSheet([], keymapOf({}, false)), 'Back')).toEqual({ label: 'Back', keys: ['alt+left'] });
    expect(rowOf(shortcutSheet([], keymapOf({}, false)), 'Open the menu')).toEqual({ label: 'Open the menu', keys: ['f10'] });
  });

  it('shows the keys a person chose, and leaves out a shortcut they removed', () => {
    const sheet = shortcutSheet([], keymapOf({ newBranch: ['mod+shift+b'], commandLog: [] }, true));
    expect(rowOf(sheet, 'New branch')).toEqual({ label: 'New branch', keys: ['mod+shift+b'] });
    expect(rowOf(sheet, 'Command log')).toBeUndefined();
  });
});
