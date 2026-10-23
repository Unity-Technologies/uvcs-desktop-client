import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The dialogs opened: what each was for, and how it saves. */
const opened = vi.hoisted(() => [] as { target: XlinkDialogTarget; save: (draft: XlinkDraft) => Promise<boolean> }[]);
vi.mock('./XlinkDialog', () => ({ openXlinkDialog: (target: XlinkDialogTarget, save: (draft: XlinkDraft) => Promise<boolean>) => opened.push({ target, save }) }));

import type { TreeItem, XlinkTarget } from '@shared/domain/explorer';
import { queryClient } from '../../app/queryClient';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { directoryListingKey } from '../files/directoryListing';
import { useFilesViewStore } from '../files/filesViewStore';
import { draftOf, type XlinkDialogTarget, type XlinkDraft } from './xlinkDraft';
import { createXlink, editXlink } from './xlinkOperations';

const ws = '/ws';
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
  it('takes no name its folder already holds, creates it as typed, refreshes the workspace and selects it', async () => {
    queryClient.setQueryData(directoryListingKey(ws, 'code'), [{ name: 'Engine' }] as TreeItem[]);
    fakeApi.answer('xlinks.create', () => undefined);
    createXlink(ws, 'code');
    const { target, save } = lastDialog();
    expect(target).toEqual({ kind: 'create', directory: 'code', siblings: ['Engine'] });

    const refreshes = watchRefreshes(ws);
    const saved = await save({ ...draftOf(target), name: 'lib', repository: 'lib@local' });

    expect(saved).toBe(true);
    expect(fakeApi.calls()).toEqual([
      {
        method: 'xlinks.create',
        args: [ws, { path: 'code/lib', repository: 'lib@local', point: { kind: 'branch', branch: '/main' }, writable: false, relativeServer: false, folder: '/', rules: [] }],
      },
    ]);
    expect(refreshes()).toEqual(['explorer', 'info', 'locks', 'pendingChanges', 'review']);
    expect(useFilesViewStore.getState().revealRequest).toMatchObject({ workspacePath: ws, path: 'code/lib' });
  });

  it('keeps the dialog open, with what was typed, when cm refuses', async () => {
    fakeApi.answer('xlinks.create', () => Promise.reject(new Error('code is not in a workspace.')));
    createXlink(ws, 'code');
    const { target, save } = lastDialog();

    expect(await save({ ...draftOf(target), name: 'lib', repository: 'lib@local' })).toBe(false);
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'error', title: "Couldn't create the xlink" })]);
    expect(useFilesViewStore.getState().revealRequest).toBeNull();
  });
});

describe('Editing an xlink', () => {
  it('reads a writable one’s rules before opening it, and saves only what changed', async () => {
    fakeApi.answer('xlinks.rules', () => [{ from: '/main', to: '/main/dev', userDefined: true }]);
    fakeApi.answer('xlinks.edit', () => undefined);
    await editXlink(ws, lib);
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
    await editXlink(ws, { ...lib, xlink: { ...WRITABLE, writable: false } });

    expect(lastDialog().target).toMatchObject({ kind: 'edit', rules: [] });
    expect(fakeApi.calls()).toEqual([]);
  });

  it('opens nothing when its rules can’t be read, and says why', async () => {
    fakeApi.answer('xlinks.rules', () => Promise.reject(new Error('The server is down')));

    await editXlink(ws, lib);

    expect(opened).toEqual([]);
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'error', title: "Couldn't read the xlink" })]);
  });
});
