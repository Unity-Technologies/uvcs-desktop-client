import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const opened = vi.hoisted(() => [] as unknown[][]);
vi.mock('../partialWorkspace/ChooseDownloadsDialog', () => ({ openChooseDownloads: (...args: unknown[]) => opened.push(args) }));

import type { TreeItem } from '@shared/domain/explorer';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import type { Action, MenuEntry } from '../../lib/actions';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { fileMenu } from './fileMenu';
import { PendingChangesIndex } from './itemStatus';

const ws = '/ws';
const standard = {
  name: 'game',
  path: ws,
  repository: 'game@local',
  repositoryName: 'game',
  server: 'local',
  selector: { kind: 'branch', name: '/main' },
  loadedChangeset: 6,
  kind: 'standard',
} as WorkspaceInfo;

const item = (path: string, itemType: 'file' | 'directory' = 'file', repository = 'game@local'): TreeItem =>
  ({ path, name: path, itemType, isPrivate: false, isCheckedOut: false, repository, size: 0, date: '', changeset: 1, branch: '/main', owner: '', revisionId: 1, parentRevisionId: 0, itemId: 1 }) as TreeItem;

const chooseDownloadsIn = (menu: MenuEntry[]) =>
  menu.find((candidate): candidate is Action => typeof candidate === 'object' && 'id' in candidate && candidate.id === 'chooseDownloads');

const entryIn = (menu: MenuEntry[], id: string) =>
  menu.find((candidate): candidate is Action => typeof candidate === 'object' && 'id' in candidate && candidate.id === id);

const menuOf = (items: TreeItem[], pending = new PendingChangesIndex([])) => fileMenu(ws, items, pending);

const seed = (workspace: Partial<WorkspaceInfo>) => queryClient.setQueryData(queryKeys.inWorkspace(ws, 'info'), { ...standard, ...workspace });

describe('fileMenu: Choose what to download', () => {
  beforeEach(() => {
    opened.splice(0);
    seed({ kind: 'partial' });
  });

  it('opens the dialog on a file of a partial workspace', () => {
    const entry = chooseDownloadsIn(menuOf([item('src/main.c')]));
    expect(entry).toBeDefined();
    entry!.run();
    expect(opened).toEqual([[ws, 'src/main.c']]);
  });

  it('opens the dialog on a folder of a partial workspace', () => {
    const entry = chooseDownloadsIn(menuOf([item('src', 'directory')]));
    entry!.run();
    expect(opened).toEqual([[ws, 'src']]);
  });

  it('is offered for one item only', () => {
    expect(chooseDownloadsIn(menuOf([item('a.c'), item('b.c')]))).toBeUndefined();
  });

  it('is not offered on a private item', () => {
    expect(chooseDownloadsIn(menuOf([{ ...item('notes.txt'), isPrivate: true, repository: '' }]))).toBeUndefined();
  });

  it('is not offered on an added item', () => {
    const pending = new PendingChangesIndex([{ path: 'new.c', kinds: ['added'], itemType: 'file', size: 0, lastModified: '' }]);
    expect(chooseDownloadsIn(menuOf([item('new.c')], pending))).toBeUndefined();
  });

  it("is not offered on another repository's item", () => {
    expect(chooseDownloadsIn(menuOf([item('lib/x.c', 'file', 'thirdparty@local')]))).toBeUndefined();
  });

  it.each([
    ['a standard workspace, where it would make it partial: that stays in its menu and the palette', { kind: 'standard' }],
    ['a dynamic workspace', { kind: 'dynamic' }],
    ['a workspace of unknown kind', { kind: undefined }],
  ] as [string, Partial<WorkspaceInfo>][])('is not offered on %s', (_, workspace) => {
    seed(workspace);
    expect(chooseDownloadsIn(menuOf([item('src/main.c')]))).toBeUndefined();
  });
});

describe('fileMenu: xlinks in a partial workspace', () => {
  const xlink = { writable: true, path: '/', changeset: 12, repository: 'lib', server: 'local' };

  it('offers no New xlink…, which it couldn’t check in; a standard workspace does', () => {
    seed({ kind: 'partial' });
    expect(entryIn(menuOf([item('src', 'directory')]), 'newXlink')).toBeUndefined();
    seed({ kind: 'standard' });
    expect(entryIn(menuOf([item('src', 'directory')]), 'newXlink')).toBeDefined();
  });

  it('keeps Edit xlink… on an xlink', () => {
    seed({ kind: 'partial' });
    expect(entryIn(menuOf([{ ...item('lib', 'directory'), xlink }]), 'editXlink')).toBeDefined();
  });
});
