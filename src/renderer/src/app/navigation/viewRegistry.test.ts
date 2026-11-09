import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import { SHORTCUTS, shortcutKeys, viewShortcut } from '../../lib/shortcutRegistry';
import { VIEWS } from './viewRegistry';

describe('views', () => {
  it('keeps each sidebar group together, so ⌘1… follow the order the sidebar shows them in', () => {
    const groups = VIEWS.map((view) => view.group).filter((group, index, all) => group !== all[index - 1]);

    expect(groups).toEqual(['Workspace', 'History', 'Collaborate']);
  });

  it('gives each view its own shortcut, in sidebar order', () => {
    expect(VIEWS.slice(0, 3).map((view) => [view.id, view.shortcut])).toEqual([
      ['changes', 'mod+1'],
      ['incoming', 'mod+2'],
      ['files', 'mod+3'],
    ]);
    expect(new Set(VIEWS.map((view) => view.shortcut)).size).toBe(VIEWS.length);
  });
});

describe('view shortcuts and the comment editor’s keys', () => {
  it('never share a key on any OS, for every view the sidebar has', () => {
    for (const mac of [true, false]) {
      const views = new Set(VIEWS.map((_, position) => viewShortcut(position, mac)));
      const comments = Object.values(SHORTCUTS)
        .filter((shortcut) => shortcut.area === 'Comments')
        .flatMap((shortcut) => shortcutKeys(shortcut, mac));
      expect(comments.filter((key) => views.has(key))).toEqual([]);
    }
  });
});
