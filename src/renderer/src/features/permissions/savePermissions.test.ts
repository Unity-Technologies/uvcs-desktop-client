import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import { NO_BITS, type ObjectPermissions, type PermissionChanges } from '@shared/domain/permissions';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { editPathBranches, parseBranchList, removePathPermissions } from './pathPermissionOperations';
import { draftChanges, EMPTY_DRAFT, removeMember, setOwner, setOwnState } from './permissionsDraft';
import { pathTarget, repositoryObjectTarget, repositoryTarget } from './permissionTargets';
import { savePermissions } from './savePermissions';

const ws = '/ws';
const branch = repositoryObjectTarget('branch', '/main/task', 'game@local');
const read: ObjectPermissions = {
  acl: { creator: 'br:/main/task@rep:game@repserver:local', entries: [{ member: 'ana', bits: { ...NO_BITS, denied: ['ci'] } }], inherited: [] },
  ownAcl: true,
  owner: { name: 'ana', kind: 'user' },
};
const developers = { name: 'Developers', kind: 'group' } as const;

/** A permissions query of the server, read before saving: saving must read it again. */
function seedPermissionsQuery(server: string, spec: string): () => boolean | undefined {
  queryClient.setQueryData(queryKeys.permissions(server, spec), read);
  return () => queryClient.getQueryState(queryKeys.permissions(server, spec))?.isInvalidated;
}

describe('saving permissions', () => {
  it('saves the changes in one request, says so, and reads the permissions on the server again, nothing else', async () => {
    fakeApi.answer('permissions.apply', () => undefined);
    const refreshed = watchRefreshes(ws);
    const reread = seedPermissionsQuery('local', 'rep:game@local');
    const changes = draftChanges(read, setOwnState(read, EMPTY_DRAFT, developers, ['ci'], 'allow'));

    expect(await savePermissions({ target: branch, permissions: read, changes, workspacePath: ws })).toBe(true);

    const [[target, request]] = fakeApi.argsOf('permissions.apply') as [[unknown, PermissionChanges]];
    expect(target).toEqual(branch);
    expect(request.entries).toEqual([{ member: developers, desired: { ...NO_BITS, allowed: ['ci'] } }]);
    expect(askedDialogs()).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Permission change saved' }]);
    expect(reread()).toBe(true);
    expect(refreshed()).toEqual([]);
  });

  it('refreshes the lists showing the owner when the object gets another', async () => {
    fakeApi.answer('permissions.apply', () => undefined);
    const refreshed = watchRefreshes(ws);

    await savePermissions({ target: branch, permissions: read, changes: draftChanges(read, setOwner(EMPTY_DRAFT, developers)), workspacePath: ws });

    expect(refreshed()).toEqual(['branchExplorer', 'branches']);
  });

  it("refreshes the home screen's repositories when a repository gets another owner", async () => {
    fakeApi.answer('permissions.apply', () => undefined);
    queryClient.setQueryData(queryKeys.repositories('local'), []);

    await savePermissions({ target: repositoryTarget('game@local'), permissions: read, changes: draftChanges(read, setOwner(EMPTY_DRAFT, developers)) });

    expect(queryClient.getQueryState(queryKeys.repositories('local'))?.isInvalidated).toBe(true);
  });

  it('asks first when an entry goes, and saves nothing unless confirmed', async () => {
    answerConfirms(false);

    expect(await savePermissions({ target: branch, permissions: read, changes: draftChanges(read, removeMember(EMPTY_DRAFT, { name: 'ana', kind: 'user' })) })).toBe(false);

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Save 1 change?' }]);
    expect(fakeApi.methods()).toEqual([]);
  });

  it('reports a failure, and still reads the permissions again so what went through shows', async () => {
    fakeApi.answer('permissions.apply', () => {
      throw commandFailure('You are not allowed to change permissions');
    });
    const reread = seedPermissionsQuery('local', 'br:/main/task@game@local');

    const saved = await savePermissions({ target: branch, permissions: read, changes: draftChanges(read, setOwnState(read, EMPTY_DRAFT, developers, ['ci'], 'deny')) });

    expect(saved).toBe(false);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't save every change", detail: 'You are not allowed to change permissions' }]);
    expect(reread()).toBe(true);
  });
});

describe('path permissions', () => {
  const path = pathTarget('game@local', '/src', 'release');

  it('removes a path’s permissions once confirmed', async () => {
    fakeApi.answer('permissions.removePath', () => undefined);

    expect(await removePathPermissions(path)).toBe(true);

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Remove the permissions of /src?' }]);
    expect(fakeApi.argsOf('permissions.removePath')).toEqual([[path]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Removed the permissions of /src' }]);
  });

  it('removes nothing unless confirmed', async () => {
    answerConfirms(false);

    expect(await removePathPermissions(path)).toBe(false);
    expect(fakeApi.methods()).toEqual([]);
  });

  it("changes a group's branches", async () => {
    fakeApi.answer('permissions.editPathBranches', () => undefined);

    await editPathBranches(path, ['/main/rel-2'], ['/main']);

    expect(fakeApi.argsOf('permissions.editPathBranches')).toEqual([[path, { add: ['/main/rel-2'], remove: ['/main'] }]]);
  });

  it('reads the branches typed, apart by commas, once each', () => {
    expect(parseBranchList(' /main, /main/release ,,/main ')).toEqual(['/main', '/main/release']);
    expect(parseBranchList('  ')).toEqual([]);
  });
});
