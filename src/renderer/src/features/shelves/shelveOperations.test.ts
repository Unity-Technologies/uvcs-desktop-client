import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({ confirmed: true, asked: [] as string[] }));
vi.mock('../../ui/dialog/confirm', () => ({
  confirm: async ({ title }: { title: string }) => {
    dialogs.asked.push(title);
    return dialogs.confirmed;
  },
}));

import type { ShelveApplyResult } from '@shared/domain/shelve';
import { useNavigation } from '../../app/navigation/navigationStore';
import { pressToastAction, shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { applyShelve, deleteShelve, shelveAway } from './shelveOperations';

const ws = '/ws';

/** `shelves.apply` answers each call with the next outcome. */
function applyAnswers(...outcomes: ShelveApplyResult[]): void {
  fakeApi.answer('shelves.apply', () => outcomes.shift());
}

beforeEach(() => {
  dialogs.confirmed = true;
  dialogs.asked = [];
});

describe('applyShelve', () => {
  it('merges the shelve at once when nothing conflicts, keeping it unless asked to delete it', async () => {
    applyAnswers({ kind: 'applied', count: 3 });

    expect(await applyShelve(ws, 12, false)).toBe(true);

    expect(fakeApi.argsOf('shelves.apply')).toEqual([[ws, 12, false, expect.any(String)]]);
    expect(whereTheWindowIs().pages).toEqual([]);
  });

  it('offers to view the changes, unless Changes is what the window shows', async () => {
    applyAnswers({ kind: 'applied', count: 3 }, { kind: 'applied', count: 1 });
    useNavigation.setState({ view: 'branches' });
    await applyShelve(ws, 12, true);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Restored 3 changes from shelve 12', action: 'View changes' }]);

    useNavigation.setState({ view: 'changes' });
    await applyShelve(ws, 13, false);
    expect(shownToasts()[1]).toEqual({ kind: 'success', title: 'Applied 1 change from shelve 13' });
  });

  it('opens the merge view on conflicts, carrying the delete for when it is done', async () => {
    applyAnswers({ kind: 'conflicts' }, { kind: 'conflicts' });

    expect(await applyShelve(ws, 12, true)).toBe(false);
    await applyShelve(ws, 13, false);

    expect(whereTheWindowIs().pages).toEqual([
      { kind: 'merge', request: { kind: 'merge', sourceSpec: 'sh:12', deleteShelve: true } },
      { kind: 'merge', request: { kind: 'merge', sourceSpec: 'sh:13' } },
    ]);
    expect(shownToasts()).toEqual([]);
  });

  it('shelves the pending changes away first when the user agrees, then applies', async () => {
    applyAnswers({ kind: 'pendingChanges' }, { kind: 'applied', count: 2 });
    fakeApi.answer('pendingChanges.shelveAndUndo', () => ({ shelveId: 40, count: 5 }));

    expect(await applyShelve(ws, 12, false)).toBe(true);

    expect(dialogs.asked).toEqual(['Shelve your changes first?']);
    expect(fakeApi.methods()).toEqual(['shelves.apply', 'pendingChanges.shelveAndUndo', 'shelves.apply']);
    expect(fakeApi.argsOf('pendingChanges.shelveAndUndo')).toEqual([[ws, null, 'Set aside to apply shelve 12', expect.any(String)]]);
  });

  it('applies nothing while the user keeps their pending changes', async () => {
    applyAnswers({ kind: 'pendingChanges' });
    dialogs.confirmed = false;

    expect(await applyShelve(ws, 12, false)).toBe(false);

    expect(fakeApi.methods()).toEqual(['shelves.apply']);
  });

  it('applies nothing when setting the pending changes aside fails', async () => {
    applyAnswers({ kind: 'pendingChanges' });
    fakeApi.answer('pendingChanges.shelveAndUndo', () => {
      throw commandFailure('Disk full');
    });

    expect(await applyShelve(ws, 12, false)).toBe(false);

    expect(fakeApi.methods()).toEqual(['shelves.apply', 'pendingChanges.shelveAndUndo']);
    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Shelving your changes failed', detail: 'Disk full' }]);
  });

  it('reports a failed apply', async () => {
    fakeApi.answer('shelves.apply', () => {
      throw commandFailure('The shelve does not exist');
    });

    expect(await applyShelve(ws, 12, false)).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Applying shelve 12 failed', detail: 'The shelve does not exist' }]);
  });
});

describe('shelveAway', () => {
  it('shelves and undoes the changes, refreshing the shelves and the workspace, and says where they went', async () => {
    fakeApi.answer('pendingChanges.shelveAndUndo', () => ({ shelveId: 40, count: 2 }));
    const refreshed = watchRefreshes(ws);

    expect(await shelveAway(ws, ['a.txt', 'b.txt'], 'Spike')).toEqual({ shelveId: 40, count: 2 });

    expect(fakeApi.argsOf('pendingChanges.shelveAndUndo')).toEqual([[ws, ['a.txt', 'b.txt'], 'Spike', expect.any(String)]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Shelved 2 changes', detail: 'In shelve 40', action: 'Undo' }]);
    expect(refreshed()).toEqual(['info', 'pendingChanges', 'review', 'shelves']);
  });

  it('puts the changes back on Undo: applies the shelve and deletes it', async () => {
    fakeApi.answer('pendingChanges.shelveAndUndo', () => ({ shelveId: 40, count: 2 }));
    const applied = new Promise<unknown[]>((resolve) =>
      fakeApi.answer('shelves.apply', (...args: unknown[]) => {
        resolve(args);
        return { kind: 'applied', count: 2 };
      }),
    );
    await shelveAway(ws, ['a.txt', 'b.txt'], 'Spike');

    pressToastAction('Shelved 2 changes');

    expect(await applied).toEqual([ws, 40, true, expect.any(String)]);
  });
});

describe('deleteShelve', () => {
  it('deletes the shelve once confirmed, and says so', async () => {
    fakeApi.answer('shelves.delete', () => undefined);

    expect(await deleteShelve(ws, 12)).toBe(true);

    expect(dialogs.asked).toEqual(['Delete shelve 12?']);
    expect(fakeApi.argsOf('shelves.delete')).toEqual([[ws, 12]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Deleted shelve 12' }]);
  });

  it('deletes nothing unless confirmed', async () => {
    dialogs.confirmed = false;

    expect(await deleteShelve(ws, 12)).toBe(false);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('tells a failed delete, so a page showing the shelve stays', async () => {
    fakeApi.answer('shelves.delete', () => {
      throw commandFailure('Access denied');
    });

    expect(await deleteShelve(ws, 12)).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the shelve", detail: 'Access denied' }]);
  });
});
