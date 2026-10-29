import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The dialogs opened: what each was for, and how it saves. */
const opened = vi.hoisted(() => [] as { target: XlinkDialogTarget; save: (draft: XlinkDraft) => Promise<boolean> }[]);
vi.mock('./XlinkDialog', () => ({ openXlinkDialog: (target: XlinkDialogTarget, save: (draft: XlinkDraft) => Promise<boolean>) => opened.push({ target, save }) }));

import type { TreeItem, XlinkTarget } from '@shared/domain/explorer';
import { workspacePlace } from '@shared/domain/place';
import { queryClient } from '../../app/queryClient';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { directoryListingKey } from '../files/directoryListing';
import { useFilesViewStore } from '../files/filesViewStore';
import { draftOf, type XlinkDialogTarget, type XlinkDraft } from './xlinkDraft';
import { createXlink, editXlink, loadXlinkFiles } from './xlinkOperations';

const ws = '/ws';
/**
 * Refreshes as a checkin or an update does (`isAffectedByCheckinOrUpdate`), told by what sets it apart without naming
 * every view, which grow: the changesets and Incoming (an edit of pending changes leaves them), not labels or shelves.
 */
function expectCheckinOrUpdateRefreshes(refreshed: readonly string[]): void {
  expect(refreshed).toEqual(expect.arrayContaining(['changesets', 'incoming', 'explorer', 'pendingChanges']));
  expect(refreshed).not.toContain('labels');
  expect(refreshed).not.toContain('shelves');
}
const WRITABLE: XlinkTarget = { writable: true, path: '/', changeset: 17, repository: 'lib', server: 'local' };
const lib = { path: 'code/lib', name: 'lib', xlink: WRITABLE };

function lastDialog() {
  const dialog = opened.at(-1);
  if (!dialog) throw new Error('No dialog opened');
  return dialog;
}

beforeEach(() => {
  opened.length = 0;
  useFilesViewStore.setState({ revealRequest: null });
});

describe('Creating an xlink', () => {
  const LIB_XLINK = { path: 'code/lib', repository: 'lib@local', point: { kind: 'branch', branch: '/main' }, writable: false, relativeServer: false, folder: '/', rules: [] };

  it('takes no name its folder already holds, creates it as typed with its comment, refreshes the workspace and selects it', async () => {
    queryClient.setQueryData(directoryListingKey(ws, 'code'), [{ name: 'Engine' }] as TreeItem[]);
    fakeApi.answer('xlinks.create', () => ({ kind: 'loaded', changesetId: 3 }));
    createXlink(ws, 'code');
    const { target, save } = lastDialog();
    expect(target).toEqual({ kind: 'create', directory: 'code', siblings: ['Engine'] });

    const refreshes = watchRefreshes(ws);
    const saved = await save({ ...draftOf(target), name: 'lib', repository: 'lib@local' });

    expect(saved).toBe(true);
    expect(fakeApi.calls()).toEqual([{ method: 'xlinks.create', args: [ws, LIB_XLINK, 'Add xlink code/lib', expect.any(String)] }]);
    // Checked in and updated: every view but those a checkin leaves alone.
    expectCheckinOrUpdateRefreshes(refreshes());
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'success', title: 'Created xlink code/lib', detail: 'Checked in as changeset 3.' })]);
    expect(useFilesViewStore.getState().revealRequest).toMatchObject({ place: workspacePlace(ws), path: 'code/lib' });
  });

  it('closes once the xlink exists, even when a later step failed, saying what is left to do', async () => {
    fakeApi.answer('xlinks.create', () => ({ kind: 'notCheckedIn', reason: 'The server is unreachable' }));
    createXlink(ws, 'code');
    const { target, save } = lastDialog();

    expect(await save({ ...draftOf(target), name: 'lib', repository: 'lib@local' })).toBe(true);
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'info', title: 'Created xlink code/lib, not checked in' })]);
    expect(useFilesViewStore.getState().revealRequest).toMatchObject({ path: 'code/lib' });
  });

  it('keeps the dialog open, with what was typed, when cm refuses to create it', async () => {
    fakeApi.answer('xlinks.create', () => Promise.reject(new Error('code is not in a workspace.')));
    createXlink(ws, 'code');
    const { target, save } = lastDialog();

    expect(await save({ ...draftOf(target), name: 'lib', repository: 'lib@local' })).toBe(false);
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'error', title: 'Creating xlink code/lib failed' })]);
    expect(useFilesViewStore.getState().revealRequest).toBeNull();
  });
});

describe('Loading a checked-in xlink’s files', () => {
  it('loads them as an operation that refreshes what an update does, and says so', async () => {
    fakeApi.answer('xlinks.load', () => ({}));
    const refreshes = watchRefreshes(ws);

    expect(await loadXlinkFiles(ws, 'code/lib')).toBe(true);

    expect(fakeApi.calls()).toEqual([{ method: 'xlinks.load', args: [ws, 'code/lib', expect.any(String)] }]);
    expectCheckinOrUpdateRefreshes(refreshes());
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'success', title: 'Loaded the files of xlink code/lib' })]);
  });
});

describe('Editing an xlink', () => {
  it('reads a writable one’s rules before opening it, and saves only what changed', async () => {
    fakeApi.answer('xlinks.rules', () => [{ from: '/main', to: '/main/dev', userDefined: true }]);
    fakeApi.answer('xlinks.edit', () => undefined);
    await editXlink(ws, lib, false);
    const { target, save } = lastDialog();
    expect(target).toMatchObject({ kind: 'edit', rules: [{ from: '/main', to: '/main/dev', userDefined: true }] });

    const saved = await save({ ...draftOf(target), point: '20' });

    expect(saved).toBe(true);
    expect(fakeApi.calls()).toEqual([
      { method: 'xlinks.rules', args: [ws, 'code/lib'] },
      { method: 'xlinks.edit', args: [ws, { path: 'code/lib', repository: 'lib@local', point: { kind: 'changeset', changeset: 20 }, removedRules: [], addedRules: [] }] },
    ]);
  });

  it('opens a read-only one at once: it has no rules to read', async () => {
    await editXlink(ws, { ...lib, xlink: { ...WRITABLE, writable: false } }, false);

    expect(lastDialog().target).toMatchObject({ kind: 'edit', rules: [] });
    expect(fakeApi.calls()).toEqual([]);
  });

  it('opens nothing when its rules can’t be read, and says why', async () => {
    fakeApi.answer('xlinks.rules', () => Promise.reject(new Error('The server is down')));

    await editXlink(ws, lib, false);

    expect(opened).toEqual([]);
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'error', title: "Couldn't read the xlink" })]);
  });
});
