import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { ShortcutDefinition } from '../../lib/shortcutRegistry';
import { shortcutSheet } from './shortcutSheet';

const views = [
  { label: 'Changes', shortcut: 'mod+1' },
  { label: 'Incoming', shortcut: 'mod+2' },
];
const palette: ShortcutDefinition = { area: 'General', label: 'Command palette', keys: ['mod+k', 'mod+shift+p'] };
const back: ShortcutDefinition = { area: 'General', label: 'Back', keys: ['mod+['], keysOffMac: ['alt+left'] };
const menu: ShortcutDefinition = { area: 'General', label: 'Open the menu', keys: ['f10'], offMacOnly: true };

describe('shortcutSheet', () => {
  it('lists the views under Go to, in sidebar order, after the areas before it', () => {
    expect(shortcutSheet(views, [palette], true)).toEqual([
      ['General', [{ label: 'Command palette', keys: ['mod+k', 'mod+shift+p'] }]],
      [
        'Go to',
        [
          { label: 'Changes', keys: ['mod+1'] },
          { label: 'Incoming', keys: ['mod+2'] },
        ],
      ],
    ]);
  });

  it("shows each shortcut's keys on this OS, and leaves out those it doesn't have", () => {
    expect(shortcutSheet([], [back, menu], true)).toEqual([['General', [{ label: 'Back', keys: ['mod+['] }]]]);
    expect(shortcutSheet([], [back, menu], false)).toEqual([
      [
        'General',
        [
          { label: 'Back', keys: ['alt+left'] },
          { label: 'Open the menu', keys: ['f10'] },
        ],
      ],
    ]);
  });
});
