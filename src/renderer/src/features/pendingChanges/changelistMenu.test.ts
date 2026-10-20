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
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import type { CheckinMode } from './checkinButton';
import { changelistMenu } from './changelistMenu';

const ws = '/ws';
const ui: Changelist = { name: 'ui', description: 'Polish the menus' };
const change = (path: string, kinds: PendingChange['kinds'], itemType: PendingChange['itemType'] = 'file'): PendingChange => ({
  path,
  kinds,
  itemType,
  size: 1,
  lastModified: '',
  changelist: 'ui',
});
const uiChanges = [
  change('src/menu.ts', ['checkedOut', 'changed']),
  change('src/icons.ts', ['added']),
  change('src/new/place.ts', ['moved']),
  change('src/old.ts', ['deleted']),
];

const labels = (menu: MenuEntry[]): string[] => menu.map((entry) => (entry === SEPARATOR ? '—' : entry.label));
const entry = (menu: MenuEntry[], id: string): Action => menu.find((candidate): candidate is Action => candidate !== SEPARATOR && 'run' in candidate && candidate.id === id)!;

beforeEach(() => {
  dialogs.askedToUndo = [];
});

describe('changelistMenu', () => {
  it('checks in, shelves or undoes the changelist, then edits it, then deletes it', () => {
    const menu = changelistMenu(ws, ui, { changes: uiChanges, prepare: () => {} });

    expect(labels(menu)).toEqual([
      'Check in this changelist',
      'Shelve this changelist',
      '—',
      'Rename…',
      'Edit description…',
      '—',
      'Undo 4 changes…',
      'Delete changelist…',
    ]);
  });

  it('readies the check-in panel to check in or shelve the changelist', () => {
    const prepared: CheckinMode[] = [];
    const menu = changelistMenu(ws, ui, { changes: uiChanges, prepare: (mode) => prepared.push(mode) });

    entry(menu, 'checkin').run();
    entry(menu, 'shelve').run();

    expect(prepared).toEqual(['checkin', 'shelve']);
  });

  it("undoes the changelist's changes, after the Undo dialog, in one command", async () => {
    const undone = new Promise<unknown[]>((resolve) => fakeApi.answer('pendingChanges.undo', (...args: unknown[]) => resolve(args)));
    const menu = changelistMenu(ws, ui, { changes: uiChanges, prepare: () => {} });

    entry(menu, 'undo').run();

    expect(await undone).toEqual([ws, ['src/menu.ts', 'src/icons.ts', 'src/new/place.ts', 'src/old.ts']]);
    expect(dialogs.askedToUndo).toEqual([uiChanges]);
    expect(fakeApi.argsOf('pendingChanges.undo')).toHaveLength(1);
  });

  it('names one change alone', () => {
    const menu = changelistMenu(ws, ui, { changes: uiChanges.slice(0, 1), prepare: () => {} });

    expect(entry(menu, 'undo').label).toBe('Undo changes…');
  });

  it('offers no shelve for a changelist of links alone: a shelve takes none', () => {
    const menu = changelistMenu(ws, ui, { changes: [change('src/link', ['checkedOut'], 'symlink')], prepare: () => {} });

    expect(labels(menu)).toEqual(['Check in this changelist', '—', 'Rename…', 'Edit description…', '—', 'Undo changes…', 'Delete changelist…']);
  });

  it('offers only editing and deleting an empty changelist', () => {
    const menu = changelistMenu(ws, ui, { changes: [], prepare: () => {} });

    expect(labels(menu)).toEqual(['Rename…', 'Edit description…', '—', 'Delete changelist…']);
  });
});
