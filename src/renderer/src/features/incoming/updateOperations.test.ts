import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BranchIncomingChanges } from '@shared/domain/incoming';
import type { Changeset } from '@shared/domain/changeset';
import { useRunningOperationsStore } from '../../app/operations/runningOperationsStore';
import { pressToastAction, shownToasts, whereTheWindowIs } from '../../testing/operationOutcome';
import { useSuccessMomentStore } from '../pendingChanges/successMoment';
import { explainUpdateConflicts, shelveBlockedAndUpdate, updateResolvingConflicts, updateToIncoming } from './updateOperations';

const ws = '/ws';
const CONFLICTS = 'The update operation detected conflicts. Please, run the update from the GUI.';

const changeset = (id: number, owner: string): Changeset => ({ id, guid: `g${id}`, branch: '/main', comment: '', owner, date: '', parent: id - 1, repository: 'game@local' });

function incoming(...changesets: Changeset[]): BranchIncomingChanges {
  return {
    branch: '/main',
    loadedChangeset: 10,
    headChangeset: changesets[0]!.id,
    changesetCount: changesets.length,
    authors: [...new Set(changesets.map((each) => each.owner))],
    changesets,
    files: [],
    conflicts: [],
    blockedPaths: [],
  };
}

const twoIn = incoming(changeset(12, 'ana'), changeset(11, 'bob'));

/** What Changes shows of the workspace's success moment, if any. */
function moment() {
  const shown = useSuccessMomentStore.getState().moments[ws];
  if (!shown) return undefined;
  const { at: _at, ...words } = shown;
  return words;
}

beforeEach(() => useSuccessMomentStore.setState({ moments: {} }));

describe('updateToIncoming', () => {
  it('updates, says what came in and from whom, and shows it in Changes', async () => {
    fakeApi.answer('workspaces.update', () => undefined);

    expect(await updateToIncoming(ws, twoIn)).toBe(true);

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Updated to cs:12 · 2 changesets from Ana, Bob', action: 'View' }]);
    expect(moment()).toEqual({ verb: 'Updated to', changesetId: 12, fromChangeset: 10, detail: '2 changesets from Ana, Bob' });
  });

  it('views one changeset that came in as that changeset, several as the range', async () => {
    fakeApi.answer('workspaces.update', () => undefined);
    await updateToIncoming(ws, incoming(changeset(12, 'ana')));
    pressToastAction('Updated to cs:12 · 1 changeset from Ana');
    await updateToIncoming(ws, twoIn);
    pressToastAction('Updated to cs:12 · 2 changesets from Ana, Bob');

    expect(whereTheWindowIs().pages).toEqual([
      { kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 } },
      { kind: 'diff', title: 'Changesets 11 to 12', target: { kind: 'range', fromSpec: 'cs:10', toSpec: 'cs:12' } },
    ]);
  });

  it('leads to Incoming when local changes collide, instead of failing', async () => {
    fakeApi.answer('workspaces.update', () => {
      throw commandFailure(CONFLICTS);
    });

    expect(await updateToIncoming(ws, twoIn)).toBe(false);

    expect(shownToasts()).toEqual([
      { kind: 'error', title: 'Update needs your decision', detail: 'Some files you changed were also changed, moved or deleted on the branch.', action: 'Open Incoming' },
    ]);
    pressToastAction('Update needs your decision');
    expect(whereTheWindowIs().view).toBe('incoming');
    expect(moment()).toBeUndefined();
  });

  it('reports any other failure as one', async () => {
    fakeApi.answer('workspaces.update', () => {
      throw commandFailure('Server unreachable');
    });

    expect(await updateToIncoming(ws, twoIn)).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Updating workspace failed', detail: 'Server unreachable' }]);
  });

  it('never starts while another update runs on the workspace', async () => {
    useRunningOperationsStore.getState().start({ id: 'other', workspacePath: ws, kind: 'switch', title: 'Switching to /main/task' });
    try {
      expect(await updateToIncoming(ws, twoIn)).toBe(false);
      expect(fakeApi.methods()).toEqual([]);
      expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'info', title: 'Switching to /main/task is still running' })]);
    } finally {
      useRunningOperationsStore.getState().finish('other');
    }
  });
});

describe('explainUpdateConflicts', () => {
  it('explains only an update stopped by colliding changes', () => {
    expect(explainUpdateConflicts(new Error(CONFLICTS))).toBe(false);
    expect(shownToasts()).toEqual([]);
  });
});

describe('shelveBlockedAndUpdate', () => {
  it('shelves the blocking files, updates, and offers them back in Changes', async () => {
    fakeApi.answer('merge.shelveBlockedAndUpdate', () => ({ shelveId: 7, count: 2, updated: true, backupDirectory: null }));

    expect(await shelveBlockedAndUpdate(ws, twoIn, { 'a.txt': 'source' } as never)).toBe(true);

    expect(fakeApi.argsOf('merge.shelveBlockedAndUpdate')).toEqual([[ws, { 'a.txt': 'source' }, expect.any(String)]]);
    expect(shownToasts()).toEqual([
      { kind: 'success', title: 'Updated to cs:12 · 2 changesets from Ana, Bob · 2 changes shelved in shelve 7', action: 'Restore in Changes' },
    ]);
    expect(moment()).toMatchObject({ verb: 'Updated to', changesetId: 12 });
  });

  it('says what is left to merge when it shelved but could not update yet', async () => {
    fakeApi.answer('merge.shelveBlockedAndUpdate', () => ({ shelveId: 7, count: 1, updated: false, backupDirectory: null }));

    expect(await shelveBlockedAndUpdate(ws, twoIn, null)).toBe(true);

    expect(shownToasts()).toEqual([{ kind: 'success', title: '1 change shelved in shelve 7 · merge the remaining files to update' }]);
    expect(moment()).toBeUndefined();
  });
});

describe('updateResolvingConflicts', () => {
  it('updates with the user’s merges, and offers the backups of the local versions', async () => {
    fakeApi.answer('merge.updateResolvingConflicts', () => ({ backupDirectory: '/tmp/backups' }));
    fakeApi.answer('system.revealInFileManager', () => undefined);

    expect(await updateResolvingConflicts(ws, twoIn, {})).toBe(true);
    pressToastAction('Updated to cs:12 · 2 changesets from Ana, Bob');

    expect(shownToasts()[0]).toMatchObject({ action: 'Show backups' });
    expect(fakeApi.argsOf('system.revealInFileManager')).toEqual([['/tmp/backups']]);
    expect(moment()).toMatchObject({ changesetId: 12 });
  });

  it('offers no backups when nothing was saved', async () => {
    fakeApi.answer('merge.updateResolvingConflicts', () => ({ backupDirectory: null }));

    await updateResolvingConflicts(ws, twoIn, {});

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Updated to cs:12 · 2 changesets from Ana, Bob' }]);
  });
});
