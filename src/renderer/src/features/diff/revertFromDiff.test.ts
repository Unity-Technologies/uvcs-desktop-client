import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry, DiffStatus, DiffTarget } from '@shared/domain/diff';
import type { ItemType } from '@shared/domain/pendingChanges';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import type { Action, MenuEntry } from '../../lib/actions';
import { askedDialogs } from '../../testing/fakeDialogs';
import { watchRefreshes } from '../../testing/operationOutcome';
import { diffEntryMenu } from './diffEntryMenu';
import { olderSideOf, revertToOlderSide } from './revertFromDiff';

const ws = '/ws';
const repository = 'game@local';
const ofChangeset: DiffTarget = { kind: 'changeset', changesetId: 42 };

/** A diff's entry as `parseDiffEntries` reads it: an item only moved keeps its revision on both sides. */
function entry(status: DiffStatus = 'changed', itemType: ItemType = 'file', inRepository = repository): DiffEntry {
  const revisionId = status === 'deleted' ? -1 : status === 'moved' ? 39 : 40;
  return { status, path: 'src/a.ts', itemType, baseRevisionId: 39, revisionId, repository: inRepository };
}

function changeset(id: number, parent: number): Changeset {
  return { id, parent, guid: 'g', branch: '/main', comment: '', owner: 'ana', date: '', repository };
}

const revertEntry = (menu: MenuEntry[]): Action | undefined =>
  menu.find((item): item is Action => typeof item === 'object' && 'id' in item && item.id === 'revert');

/** What the menu's entry runs for the diff's file, awaited. */
async function revertFrom(target: DiffTarget): Promise<void> {
  fakeApi.answer('history.revertTo', () => undefined);
  await revertToOlderSide(ws, entry().path, olderSideOf(target)!);
}

describe("a diff's older side", () => {
  it("is a changeset's parent, or a range's first changeset", () => {
    expect(olderSideOf(ofChangeset)).toEqual({ kind: 'parentOf', changesetId: 42 });
    expect(olderSideOf({ kind: 'range', fromSpec: 'cs:12', toSpec: 'cs:20' })).toEqual({ kind: 'changeset', changesetId: 12 });
  });

  it('is unknown for a branch, a range between labels and a shelve, which no changeset of theirs names', () => {
    expect(olderSideOf({ kind: 'branch', branch: '/main/task' })).toBeNull();
    expect(olderSideOf({ kind: 'range', fromSpec: 'lb:v1.0', toSpec: 'lb:v2.0' })).toBeNull();
    expect(olderSideOf({ kind: 'shelve', shelveId: 3 })).toBeNull();
  });
});

describe("a diff's file menu", () => {
  it('reverts one file the diff changed, in the workspace\'s repository, to before the change', () => {
    const menu = diffEntryMenu(ws, ofChangeset, [entry()], { workspaceRepository: repository });

    expect(revertEntry(menu)).toMatchObject({ label: 'Revert file to before this change…', menuGroup: 'act' });
    expect(revertEntry(diffEntryMenu(ws, ofChangeset, [entry('changed', 'binaryFile')], { workspaceRepository: repository }))).toBeDefined();
  });

  it('reverts a file moved and edited: its content goes back, its name stays', () => {
    const movedAndEdited = { ...entry('moved'), revisionId: 40, oldPath: 'src/old/a.ts' };

    expect(revertEntry(diffEntryMenu(ws, ofChangeset, [movedAndEdited], { workspaceRepository: repository }))).toBeDefined();
  });

  it('offers no revert for a file added, deleted or only moved, a folder or an xlink', () => {
    for (const offered of [entry('added'), entry('deleted'), entry('moved'), entry('changed', 'directory'), entry('changed', 'xlink')]) {
      expect(revertEntry(diffEntryMenu(ws, ofChangeset, [offered], { workspaceRepository: repository })), JSON.stringify(offered)).toBeUndefined();
    }
  });

  it("offers no revert for a file of an xlinked repository, nor while the workspace's repository isn't known", () => {
    expect(revertEntry(diffEntryMenu(ws, ofChangeset, [entry('changed', 'file', 'thirdparty@local')], { workspaceRepository: repository }))).toBeUndefined();
    expect(revertEntry(diffEntryMenu(ws, ofChangeset, [entry()]))).toBeUndefined();
  });

  it('offers no revert for several files, nor for a diff with no changeset before it', () => {
    expect(revertEntry(diffEntryMenu(ws, ofChangeset, [entry(), entry()], { workspaceRepository: repository }))).toBeUndefined();
    expect(revertEntry(diffEntryMenu(ws, { kind: 'branch', branch: '/main/task' }, [entry()], { workspaceRepository: repository }))).toBeUndefined();
    expect(revertEntry(diffEntryMenu(ws, { kind: 'shelve', shelveId: 3 }, [entry()], { workspaceRepository: repository }))).toBeUndefined();
  });
});

describe('reverting a file from a diff', () => {
  it("runs from the file's menu, reverting it to the older side once confirmed", async () => {
    fakeApi.answer('changesets.get', () => changeset(42, 37));
    const reverted = new Promise((resolve) => fakeApi.answer('history.revertTo', (...args: unknown[]) => resolve(args)));

    revertEntry(diffEntryMenu(ws, ofChangeset, [entry()], { workspaceRepository: repository }))!.run();

    expect(await reverted).toEqual([ws, 'src/a.ts', 37]);
    expect(askedDialogs()).toHaveLength(1);
  });

  it("reverts a changeset's file to the changeset's parent, read once", async () => {
    fakeApi.answer('changesets.get', () => changeset(42, 37));
    const refreshed = watchRefreshes(ws);

    await revertFrom(ofChangeset);

    expect(fakeApi.argsOf('changesets.get')).toEqual([[ws, 42]]);
    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Revert src/a.ts to changeset 37, before changeset 42?' }]);
    expect(fakeApi.argsOf('history.revertTo')).toEqual([[ws, 'src/a.ts', 37]]);
    expect(refreshed()).toEqual(['explorer', 'info', 'locks', 'pendingChanges', 'review']);
  });

  it('takes the parent from the changeset already read for the diff, asking the server nothing more', async () => {
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'changesets', 'byId', 42, undefined), changeset(42, 37));

    await revertFrom(ofChangeset);

    expect(fakeApi.methods()).toEqual(['history.revertTo']);
    expect(fakeApi.argsOf('history.revertTo')).toEqual([[ws, 'src/a.ts', 37]]);
  });

  it("reverts a range's file to the range's first changeset", async () => {
    await revertFrom({ kind: 'range', fromSpec: 'cs:12', toSpec: 'cs:20' });

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Revert src/a.ts to changeset 12?' }]);
    expect(fakeApi.argsOf('history.revertTo')).toEqual([[ws, 'src/a.ts', 12]]);
  });
});
