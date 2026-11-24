import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { workspacePlace } from '@shared/domain/place';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { queryClient } from '../../app/queryClient';
import { branchQuery } from '../branches/useBranches';
import { leftChangesQuery } from './leftChangesQuery';

const ws = '/work/game';
const onTask1: WorkspaceSelector = { kind: 'branch', name: '/main/task1' };
const task1 = { id: 37, name: '/main/task1', isHidden: true } as Branch;

afterEach(() => queryClient.clear());

function findLeftChanges(selector: WorkspaceSelector) {
  fakeApi.answer('leftChanges.find', () => []);
  return queryClient.fetchQuery(leftChangesQuery(ws, selector));
}

describe('leftChangesQuery', () => {
  it('hands over the branch the top bar read, however old, without reading it again', async () => {
    queryClient.setQueryData(branchQuery(workspacePlace(ws), '/main/task1').queryKey, task1, { updatedAt: 0 });

    await findLeftChanges(onTask1);

    expect(fakeApi.methods()).toEqual(['leftChanges.find']);
    expect(fakeApi.argsOf('leftChanges.find')).toEqual([[ws, { name: '/main/task1', id: 37 }]]);
  });

  it("reads the branch once with the top bar's read when it isn't read yet", async () => {
    fakeApi.answer('branches.get', () => task1);

    await Promise.all([findLeftChanges(onTask1), queryClient.fetchQuery(branchQuery(workspacePlace(ws), '/main/task1'))]);

    expect(fakeApi.argsOf('branches.get')).toHaveLength(1);
    expect(fakeApi.argsOf('leftChanges.find')).toEqual([[ws, { name: '/main/task1', id: 37 }]]);
  });

  it('hands over no branch it could not read: the main process looks it up itself', async () => {
    fakeApi.answer('branches.get', () => {
      throw commandFailure('The server is not reachable');
    });

    await findLeftChanges(onTask1);

    expect(fakeApi.argsOf('leftChanges.find')).toEqual([[ws, undefined]]);
  });

  it('reads no branch on a label or a changeset', async () => {
    await findLeftChanges({ kind: 'label', name: 'v1' });
    await findLeftChanges({ kind: 'changeset', name: '12' });

    expect(fakeApi.methods()).toEqual(['leftChanges.find', 'leftChanges.find']);
  });
});
