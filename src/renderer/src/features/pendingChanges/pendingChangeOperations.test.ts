import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({
  undo: undefined as { backup: boolean } | undefined,
  askedToUndo: [] as unknown[],
  confirmed: true,
  typed: undefined as string | undefined,
}));
vi.mock('./UndoChangesDialog', () => ({
  askUndoChanges: async (changes: unknown) => {
    dialogs.askedToUndo.push(changes);
    return dialogs.undo;
  },
}));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => dialogs.confirmed }));
vi.mock('../../ui/dialog/prompt', () => ({ prompt: async () => dialogs.typed }));

import type { PendingChange } from '@shared/domain/pendingChanges';
import { pressToastAction, shownToasts, whereTheWindowIs } from '../../testing/operationOutcome';
import { absolutePath, deletePrivateFiles, undoChanges } from './pendingChangeOperations';
import { BACKUP_SHELVE_COMMENT } from './undoPlan';

const ws = '/ws';
const change = (path: string, kinds: PendingChange['kinds'], itemType: PendingChange['itemType'] = 'file'): PendingChange => ({ path, kinds, itemType, size: 1, lastModified: '' });

beforeEach(() => {
  dialogs.undo = undefined;
  dialogs.askedToUndo = [];
  dialogs.confirmed = true;
  dialogs.typed = undefined;
});

describe('undoChanges', () => {
  const edited = change('src/a.ts', ['checkedOut', 'changed']);
  const added = change('src/new.ts', ['added']);
  const link = change('src/link', ['changed'], 'symlink');
  const privateFile = change('notes.txt', ['private']);

  it('asks only about the changes under version control, and undoes those', async () => {
    dialogs.undo = { backup: false };
    fakeApi.answer('pendingChanges.undo', () => undefined);

    await undoChanges(ws, [edited, privateFile, added]);

    expect(dialogs.askedToUndo).toEqual([[edited, added]]);
    expect(fakeApi.argsOf('pendingChanges.undo')).toEqual([[ws, ['src/a.ts', 'src/new.ts']]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Undid 2 changes' }]);
  });

  it('asks nothing when only private files are picked', async () => {
    await undoChanges(ws, [privateFile]);

    expect(dialogs.askedToUndo).toEqual([]);
  });

  it('undoes nothing when the dialog is cancelled', async () => {
    await undoChanges(ws, [edited]);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('shelves a backup of what a shelve can take first, then undoes everything, and leads to the backup', async () => {
    dialogs.undo = { backup: true };
    fakeApi.answer('pendingChanges.shelve', () => 31);
    fakeApi.answer('pendingChanges.undo', () => undefined);

    await undoChanges(ws, [edited, link]);

    expect(fakeApi.methods()).toEqual(['pendingChanges.shelve', 'pendingChanges.undo']);
    expect(fakeApi.argsOf('pendingChanges.shelve')[0]!.slice(0, 3)).toEqual([ws, ['src/a.ts'], BACKUP_SHELVE_COMMENT]);
    expect(fakeApi.argsOf('pendingChanges.undo')).toEqual([[ws, ['src/a.ts', 'src/link']]]);
    pressToastAction('Undid 2 changes · backed up in shelve 31');
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'diff', title: 'Shelve 31', target: { kind: 'shelve', shelveId: 31 } }]);
  });

  it('undoes nothing when the backup fails, and says so', async () => {
    dialogs.undo = { backup: true };
    fakeApi.answer('pendingChanges.shelve', () => {
      throw new Error('server down');
    });

    await undoChanges(ws, [edited]);

    expect(fakeApi.methods()).toEqual(['pendingChanges.shelve']);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't shelve a backup, so nothing was undone", detail: 'server down' }]);
  });

  it('reports a failed undo without claiming success', async () => {
    dialogs.undo = { backup: false };
    fakeApi.answer('pendingChanges.undo', () => {
      throw new Error('locked');
    });

    await undoChanges(ws, [edited]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't undo the changes", detail: 'locked' }]);
  });
});

describe('deletePrivateFiles', () => {
  it('moves the files to the trash by their full paths once confirmed', async () => {
    fakeApi.answer('system.moveToTrash', () => undefined);

    await deletePrivateFiles(ws, [{ path: 'build/out.log' }, { path: 'tmp.txt' }]);

    expect(fakeApi.argsOf('system.moveToTrash')).toEqual([[['/ws/build/out.log', '/ws/tmp.txt']]]);
  });

  it('deletes nothing unless confirmed', async () => {
    dialogs.confirmed = false;

    await deletePrivateFiles(ws, [{ path: 'tmp.txt' }]);

    expect(fakeApi.methods()).toEqual([]);
  });
});

describe('absolutePath', () => {
  it("joins with the workspace's own separator", () => {
    expect(absolutePath('/Users/ana/ws', 'src/a.ts')).toBe('/Users/ana/ws/src/a.ts');
    expect(absolutePath('C:\\ws', 'src/deep/a.ts')).toBe('C:\\ws\\src\\deep\\a.ts');
  });
});
