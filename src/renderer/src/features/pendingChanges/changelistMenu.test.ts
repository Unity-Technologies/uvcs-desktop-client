import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({ askedToUndo: [] as unknown[] }));
vi.mock('./UndoChangesDialog', () => ({
  askUndoChanges: async (changes: unknown) => {
    dialogs.askedToUndo.push(changes);
    return { backup: false };
  },
}));

import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { isSubmenu, SEPARATOR, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import type { CheckinMode } from './checkinButton';
import { changelistHasMenu, changelistMenu } from './changelistMenu';

const ws = '/ws';
const ui: Changelist = { name: 'ui', description: 'Polish the menus' };
const art: Changelist = { name: 'art', description: '' };
const changelists = [ui, art];
const change = (path: string, kinds: PendingChange['kinds'], itemType: PendingChange['itemType'] = 'file', changelist: string | null = 'ui'): PendingChange => ({
  path,
  kinds,
  itemType,
  size: 1,
  lastModified: '',
  ...(changelist !== null && { changelist }),
});
const uiChanges = [
  change('src/menu.ts', ['checkedOut', 'changed']),
  change('src/icons.ts', ['added']),
  change('src/new/place.ts', ['moved']),
  change('src/old.ts', ['deleted']),
];

const defaultChanges = [change('README.md', ['checkedOut', 'changed'], 'file', null), change('notes.txt', ['private'], 'file', null)];

const labels = (menu: MenuEntry[]): string[] => menu.map((entry) => (entry === SEPARATOR ? '—' : entry.label));
const entry = (menu: MenuEntry[], id: string): Action => menu.find((candidate): candidate is Action => candidate !== SEPARATOR && 'run' in candidate && candidate.id === id)!;
const submenu = (menu: MenuEntry[], id: string): Submenu => menu.find((candidate): candidate is Submenu => candidate !== SEPARATOR && isSubmenu(candidate) && candidate.id === id)!;
const enabledIn = (entries: MenuEntry[]): string[] =>
  entries.filter((candidate): candidate is Action => candidate !== SEPARATOR && 'run' in candidate && !candidate.disabled).map((candidate) => candidate.label);

beforeEach(() => {
  dialogs.askedToUndo = [];
});

describe('changelistMenu', () => {
  it('checks in, shelves or undoes the changelist, then edits it, then deletes it', () => {
    const menu = changelistMenu(ws, ui, { changes: uiChanges, prepare: () => {}, changelists, clearFilter: () => {} });

    expect(labels(menu)).toEqual([
      'Check in this changelist',
      'Shelve this changelist',
      '—',
      'Rename…',
      'Edit description…',
      'Move to changelist',
      '—',
      'Undo 4 changes…',
      'Delete changelist…',
    ]);
  });

  it('readies the check-in panel to check in or shelve the changelist', () => {
    const prepared: CheckinMode[] = [];
    const menu = changelistMenu(ws, ui, { changes: uiChanges, prepare: (mode) => prepared.push(mode), changelists, clearFilter: () => {} });

    entry(menu, 'checkin').run();
    entry(menu, 'shelve').run();

    expect(prepared).toEqual(['checkin', 'shelve']);
  });

  it("undoes the changelist's changes, after the Undo dialog, in one command", async () => {
    const undone = new Promise<unknown[]>((resolve) => fakeApi.answer('pendingChanges.undo', (...args: unknown[]) => resolve(args)));
    const menu = changelistMenu(ws, ui, { changes: uiChanges, prepare: () => {}, changelists, clearFilter: () => {} });

    entry(menu, 'undo').run();

    expect(await undone).toEqual([ws, ['src/menu.ts', 'src/icons.ts', 'src/new/place.ts', 'src/old.ts']]);
    expect(dialogs.askedToUndo).toEqual([uiChanges]);
    expect(fakeApi.argsOf('pendingChanges.undo')).toHaveLength(1);
  });

  it('names one change alone', () => {
    const menu = changelistMenu(ws, ui, { changes: uiChanges.slice(0, 1), prepare: () => {}, changelists, clearFilter: () => {} });

    expect(entry(menu, 'undo').label).toBe('Undo changes…');
  });

  it('offers no shelve for a changelist of links alone: a shelve takes none', () => {
    const menu = changelistMenu(ws, ui, { changes: [change('src/link', ['checkedOut'], 'symlink')], prepare: () => {}, changelists, clearFilter: () => {} });

    expect(labels(menu)).toEqual(['Check in this changelist', '—', 'Rename…', 'Edit description…', 'Move to changelist', '—', 'Undo changes…', 'Delete changelist…']);
  });

  it('offers only editing and deleting an empty changelist', () => {
    const menu = changelistMenu(ws, ui, { changes: [], prepare: () => {}, changelists, clearFilter: () => {} });

    expect(labels(menu)).toEqual(['Rename…', 'Edit description…', '—', 'Delete changelist…']);
  });

  // Its changes the filters hide move too: cleared, the list shows every change that moved.
  it("moves all its changes to another changelist, its own offered but disabled, after clearing the filters", async () => {
    const steps: string[] = [];
    const moved = new Promise<unknown[]>((resolve) =>
      fakeApi.answer('pendingChanges.moveToChangelist', (...args: unknown[]) => {
        steps.push('move');
        resolve(args);
      }),
    );
    const clearFilter = () => void steps.push('clearFilter');
    const move = submenu(changelistMenu(ws, ui, { changes: uiChanges, prepare: () => {}, changelists, clearFilter }), 'changelist');

    expect(enabledIn(move.entries)).toEqual(['New changelist…', 'Default changelist', 'art']);
    (move.entries.find((candidate) => candidate !== SEPARATOR && 'run' in candidate && candidate.id === 'changelist.art') as Action).run();

    expect(await moved).toEqual([ws, 'art', ['src/menu.ts', 'src/icons.ts', 'src/new/place.ts', 'src/old.ts']]);
    expect(steps).toEqual(['clearFilter', 'move']);
  });
});

describe('changelistMenu of the default changelist', () => {
  // The same menu as every changelist's: it can't be renamed, described or deleted, so those aren't offered.
  it('checks in, shelves, moves or undoes its changes, as any changelist does', () => {
    const menu = changelistMenu(ws, null, { changes: defaultChanges, prepare: () => {}, changelists, clearFilter: () => {} });

    expect(labels(menu)).toEqual(['Check in this changelist', 'Shelve this changelist', '—', 'Move to changelist', '—', 'Undo changes…']);
  });

  it('readies the check-in panel to check in or shelve it', () => {
    const prepared: CheckinMode[] = [];
    const menu = changelistMenu(ws, null, { changes: defaultChanges, prepare: (mode) => prepared.push(mode), changelists, clearFilter: () => {} });

    entry(menu, 'checkin').run();
    entry(menu, 'shelve').run();

    expect(prepared).toEqual(['checkin', 'shelve']);
  });

  it('undoes the changes under version control, after the Undo dialog: a private file has none to undo', async () => {
    const undone = new Promise<unknown[]>((resolve) => fakeApi.answer('pendingChanges.undo', (...args: unknown[]) => resolve(args)));
    const menu = changelistMenu(ws, null, { changes: defaultChanges, prepare: () => {}, changelists, clearFilter: () => {} });

    entry(menu, 'undo').run();

    expect(await undone).toEqual([ws, ['README.md']]);
  });

  it('moves its changes to a user changelist, the default one offered but disabled', () => {
    const move = submenu(changelistMenu(ws, null, { changes: defaultChanges, prepare: () => {}, changelists, clearFilter: () => {} }), 'changelist');

    expect(enabledIn(move.entries)).toEqual(['New changelist…', 'ui', 'art']);
  });

  it('offers only checking in a default changelist of private files: none can be shelved, undone or moved', () => {
    const menu = changelistMenu(ws, null, { changes: [defaultChanges[1]!], prepare: () => {}, changelists, clearFilter: () => {} });

    expect(labels(menu)).toEqual(['Check in this changelist']);
  });
});

describe('changelistHasMenu', () => {
  it('gives every user changelist a menu, an empty one too: it can be renamed or deleted', () => {
    expect(changelistHasMenu(ui, [])).toBe(true);
  });

  it('gives the default changelist a menu while it holds a change it can act on', () => {
    expect(changelistHasMenu(null, defaultChanges)).toBe(true);
    expect(changelistHasMenu(null, [defaultChanges[1]!])).toBe(true);
  });

  // Agrees with `changelistMenu`, which would be empty: the header shows no "…".
  it('gives none to a default changelist of ignored or cloaked files alone', () => {
    const ignoredOnly = [change('build/out.log', ['ignored'], 'file', null), change('Library/cache.bin', ['cloaked'], 'file', null)];

    expect(changelistHasMenu(null, ignoredOnly)).toBe(false);
    expect(changelistMenu(ws, null, { changes: ignoredOnly, prepare: () => {}, changelists, clearFilter: () => {} })).toEqual([]);
  });
});

// The "…" shows exactly when its menu has an entry, whatever the default changelist holds.
describe('changelistHasMenu agrees with changelistMenu', () => {
  const only = (kinds: PendingChange['kinds'], itemType: PendingChange['itemType'] = 'file') => [change('item', kinds, itemType, null)];
  it.each([
    ['private', only(['private'])],
    ['a link', only(['checkedOut'], 'symlink')],
    ['hidden-changed', only(['hiddenChanged'])],
    ['ignored', only(['ignored'])],
    ['cloaked', only(['cloaked'])],
    ['nothing', []],
  ])('on a default changelist of %s files', (_, changes) => {
    const menu = changelistMenu(ws, null, { changes, prepare: () => {}, changelists, clearFilter: () => {} });

    expect(changelistHasMenu(null, changes)).toBe(menu.length > 0);
  });
});
