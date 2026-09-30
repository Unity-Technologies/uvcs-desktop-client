import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { pullBranch, pushBranch, syncWithGit } from './syncOperations';

const ws = '/ws';
const push = { branch: '/main/task', from: 'game@local', to: 'game@cloud' };
const pull = { branch: '/main/task', from: 'game@cloud', to: 'game@local' };
const brought = (changesets: number) => ({ changesets, labels: 0, items: 0 });

describe('sync operations', () => {
  it('pushes the branch as asked and counts what went', async () => {
    fakeApi.answer('sync.push', () => brought(3));

    expect(await pushBranch(ws, push)).toEqual(brought(3));

    expect(fakeApi.argsOf('sync.push')).toEqual([[ws, push, expect.any(String)]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Pushed 3 changesets of /main/task to game@cloud' }]);
  });

  it('refreshes nothing after a push: only the other repository changed', async () => {
    fakeApi.answer('sync.push', () => brought(3));
    const refreshed = watchRefreshes(ws);

    await pushBranch(ws, push);

    expect(refreshed()).toEqual([]);
  });

  it('pulls the branch as asked, saying when there was nothing new', async () => {
    fakeApi.answer('sync.pull', () => brought(0));

    await pullBranch(ws, pull);

    expect(fakeApi.argsOf('sync.pull')).toEqual([[ws, pull, expect.any(String)]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: '/main/task is already up to date with game@cloud' }]);
  });

  it('names the branch and the other side when a push or a pull fails', async () => {
    const denied = () => {
      throw commandFailure('Access denied');
    };
    fakeApi.answer('sync.push', denied);
    fakeApi.answer('sync.pull', denied);

    expect(await pushBranch(ws, push)).toBeUndefined();
    expect(await pullBranch(ws, pull)).toBeUndefined();

    expect(shownToasts()).toEqual([
      { kind: 'error', title: 'Pushing /main/task to game@cloud failed', detail: 'Access denied' },
      { kind: 'error', title: 'Pulling /main/task from game@cloud failed', detail: 'Access denied' },
    ]);
  });

  it('says the repository is in sync with the Git remote once synced', async () => {
    fakeApi.answer('sync.syncWithGit', () => undefined);

    await syncWithGit(ws, { repository: 'game@local', url: 'https://github.com/team/game.git' });

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'game@local is in sync with https://github.com/team/game.git' }]);
  });
});
