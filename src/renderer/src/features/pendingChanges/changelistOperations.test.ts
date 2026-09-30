import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({ confirmed: true, typed: undefined as string | undefined }));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => dialogs.confirmed }));
vi.mock('../../ui/dialog/prompt', () => ({ prompt: async () => dialogs.typed }));

import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { deleteChangelist, editChangelistDescription, moveToChangelist, moveToNewChangelist, renameChangelist } from './changelistOperations';

const ws = '/ws';
const change = (path: string, kinds: PendingChange['kinds']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '' });

beforeEach(() => {
  dialogs.confirmed = true;
  dialogs.typed = undefined;
});

describe('changelist operations', () => {
  const list: Changelist = { name: 'UI', description: 'Screens' };

  it('checks out the locally changed files before moving changes to a changelist: only added and checked-out items can be in one', async () => {
    fakeApi.answer('pendingChanges.checkout', () => undefined);
    fakeApi.answer('pendingChanges.moveToChangelist', () => undefined);

    await moveToChangelist(ws, 'UI', [change('a.ts', ['changed']), change('b.ts', ['checkedOut', 'changed']), change('c.ts', ['added'])]);

    expect(fakeApi.calls()).toEqual([
      { method: 'pendingChanges.checkout', args: [ws, ['a.ts']] },
      { method: 'pendingChanges.moveToChangelist', args: [ws, 'UI', ['a.ts', 'b.ts', 'c.ts']] },
    ]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Moved 3 changes to UI' }]);
  });

  it('checks out nothing when every change can already be in a changelist, and names the default one', async () => {
    fakeApi.answer('pendingChanges.moveToChangelist', () => undefined);

    await moveToChangelist(ws, null, [change('c.ts', ['added'])]);

    expect(fakeApi.methods()).toEqual(['pendingChanges.moveToChangelist']);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Moved 1 change to Default changelist' }]);
  });

  it('moves nothing when the checkout fails', async () => {
    fakeApi.answer('pendingChanges.checkout', () => {
      throw new Error('locked by bob');
    });

    await moveToChangelist(ws, 'UI', [change('a.ts', ['changed'])]);

    expect(fakeApi.methods()).toEqual(['pendingChanges.checkout']);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't move the changes", detail: 'locked by bob' }]);
  });

  it('creates a new changelist with the name typed and moves the changes into it', async () => {
    dialogs.typed = 'Refactor';
    fakeApi.answer('pendingChanges.createChangelist', () => undefined);
    fakeApi.answer('pendingChanges.moveToChangelist', () => undefined);

    await moveToNewChangelist(ws, [change('c.ts', ['added'])]);

    expect(fakeApi.calls()).toEqual([
      { method: 'pendingChanges.createChangelist', args: [ws, { name: 'Refactor', description: '' }] },
      { method: 'pendingChanges.moveToChangelist', args: [ws, 'Refactor', ['c.ts']] },
    ]);
  });

  it('moves nothing into a changelist that could not be created', async () => {
    dialogs.typed = 'Refactor';
    fakeApi.answer('pendingChanges.createChangelist', () => {
      throw new Error('exists');
    });

    await moveToNewChangelist(ws, [change('c.ts', ['added'])]);

    expect(fakeApi.methods()).toEqual(['pendingChanges.createChangelist']);
  });

  it('renames and describes a changelist keeping the rest of it', async () => {
    fakeApi.answer('pendingChanges.editChangelist', () => undefined);
    dialogs.typed = 'Screens';
    await renameChangelist(ws, list);
    dialogs.typed = 'All the screens';
    await editChangelistDescription(ws, list);

    expect(fakeApi.argsOf('pendingChanges.editChangelist')).toEqual([
      [ws, 'UI', { name: 'Screens', description: 'Screens' }],
      [ws, 'UI', { name: 'UI', description: 'All the screens' }],
    ]);
  });

  it('deletes a changelist only once confirmed; its changes stay', async () => {
    fakeApi.answer('pendingChanges.deleteChangelist', () => undefined);
    dialogs.confirmed = false;
    await deleteChangelist(ws, list);
    expect(fakeApi.methods()).toEqual([]);

    dialogs.confirmed = true;
    const refreshed = watchRefreshes(ws);
    await deleteChangelist(ws, list);
    expect(fakeApi.argsOf('pendingChanges.deleteChangelist')).toEqual([[ws, 'UI']]);
    expect(refreshed()).toContain('pendingChanges');
  });
});
