import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const opened = vi.hoisted(() => [] as unknown[]);
vi.mock('./PermissionsDialog', () => ({ openPermissionsDialog: (options: unknown) => opened.push(options) }));

import type { TreeItem } from '@shared/domain/explorer';
import type { Action, MenuEntry } from '../../lib/actions';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { repositoryMenu } from '../../app/home/homeMenus';
import { shownToasts } from '../../testing/operationOutcome';
import { attributeTypeMenu } from '../attributes/attributeTypeMenu';
import { branchMenu } from '../branches/branchMenu';
import { fileMenu } from '../files/fileMenu';
import { PendingChangesIndex } from '../files/itemStatus';
import { labelMenu } from '../labels/labelMenu';
import { openWorkspaceRepositoryPermissions } from './openPermissions';

const ws = '/ws';
const workspace = { name: 'game', path: ws, repository: 'game@local', repositoryName: 'game', server: 'local', selector: { kind: 'branch', name: '/main' }, loadedChangeset: 6 } as WorkspaceInfo;
const entry = (menu: MenuEntry[], id: string) => menu.find((candidate): candidate is Action => typeof candidate === 'object' && 'id' in candidate && candidate.id === id);
const file = (path: string, repository = 'game@local'): TreeItem =>
  ({ path, name: path, itemType: 'file', isPrivate: false, isCheckedOut: false, repository, size: 0, date: '', changeset: 1, branch: '/main', owner: '', revisionId: 1, parentRevisionId: 0, itemId: 1 }) as TreeItem;

beforeEach(() => {
  opened.splice(0);
  queryClient.setQueryData(queryKeys.inWorkspace(ws, 'info'), workspace);
});

describe('opening permissions from the menus', () => {
  it("opens a branch's, a label's and an attribute's, in their repository, with the owner their list read", () => {
    entry(branchMenu(ws, [{ id: 1, name: '/main/task', parent: '/main', comment: '', owner: 'ana', date: '', headChangeset: 3, repository: 'game@local' }], '/main'), 'permissions')!.run();
    entry(labelMenu(ws, [{ name: 'v1', changeset: 3, branch: '/main', comment: '', owner: 'bob', date: '', repository: 'other@acme@cloud' }]), 'permissions')!.run();
    entry(attributeTypeMenu(ws, [{ id: 1, name: 'status', comment: '', owner: '', date: '', repository: '' }]), 'permissions')!.run();

    expect(opened).toEqual([
      { target: { kind: 'branch', server: 'local', repository: 'game@local', name: '/main/task', knownOwner: 'ana' }, workspacePath: ws },
      { target: { kind: 'label', server: 'acme@cloud', repository: 'other@acme@cloud', name: 'v1', knownOwner: 'bob' }, workspacePath: ws },
      // An object listed without its repository is the workspace's.
      { target: { kind: 'attribute', server: 'local', repository: 'game@local', name: 'status' }, workspacePath: ws },
    ]);
  });

  it("opens a file's path permissions on every branch, and none for an item under an xlink", () => {
    entry(fileMenu(ws, [file('src/a.ts')], new PendingChangesIndex([])), 'pathPermissions')!.run();
    const xlinked = entry(fileMenu(ws, [file('lib/b.ts', 'thirdparty@local')], new PendingChangesIndex([])), 'pathPermissions')!;

    expect(opened).toEqual([{ target: { kind: 'path', server: 'local', repository: 'game@local', name: '/src/a.ts' }, workspacePath: ws }]);
    expect(xlinked).toMatchObject({ disabled: true, disabledReason: expect.stringContaining('xlink') });
  });

  it("offers no path permissions for a private item, which the server doesn't know", () => {
    expect(entry(fileMenu(ws, [{ ...file('notes.txt'), isPrivate: true, repository: '' }], new PendingChangesIndex([])), 'pathPermissions')).toBeUndefined();
  });

  it("opens a repository's permissions, its paths' and its server's from the home screen", () => {
    const menu = repositoryMenu({ id: '1', name: 'game', server: 'acme@cloud', owner: 'ana', spec: 'game@acme@cloud' }, () => {});

    for (const id of ['permissions', 'pathPermissions', 'serverPermissions']) entry(menu, id)!.run();

    expect(opened).toEqual([
      { target: { kind: 'repository', server: 'acme@cloud', repository: 'game@acme@cloud', name: 'game', knownOwner: 'ana' }, workspacePath: undefined },
      { target: { kind: 'path', server: 'acme@cloud', repository: 'game@acme@cloud', name: '/' }, workspacePath: undefined },
      { target: { kind: 'server', server: 'acme@cloud', name: 'acme@cloud' }, workspacePath: undefined },
    ]);
  });

  it("opens the workspace's repository, paths and server from the palette", () => {
    openWorkspaceRepositoryPermissions(ws, 'repository');
    openWorkspaceRepositoryPermissions(ws, 'server');

    expect(opened).toEqual([
      { target: { kind: 'repository', server: 'local', repository: 'game@local', name: 'game' }, workspacePath: ws },
      { target: { kind: 'server', server: 'local', name: 'local' }, workspacePath: ws },
    ]);
  });

  it("says so when the workspace's repository isn't known yet, rather than guessing", () => {
    queryClient.removeQueries({ queryKey: queryKeys.inWorkspace(ws, 'info') });

    openWorkspaceRepositoryPermissions(ws, 'repository');

    expect(opened).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't open the permissions", detail: 'The workspace’s repository isn’t known yet.' }]);
  });
});
