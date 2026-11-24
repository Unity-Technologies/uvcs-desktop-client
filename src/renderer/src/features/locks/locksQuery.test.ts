import { fakeApi } from '../../testing/fakeWindow';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { createQueryClient, invalidateWorkspaceIn } from '../../app/queryClient';
import { isAffectedByLocks } from '../../app/refresh/refreshScopes';
import { locksQuery, type LocksScope } from './locksQuery';

const ws = '/work/game';
const place = workspacePlace(ws);
const repository = 'game@local';

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
});
afterEach(() => {
  client.unmount();
  client.clear();
});

/** A view showing the locks in `scope`, as its `useQuery` does: the read it starts awaited. */
async function show(scope: LocksScope): Promise<() => void> {
  const query = locksQuery(place, repository, scope);
  const stop = new QueryObserver(client, query).subscribe(() => {});
  await client.getQueryCache().find({ queryKey: query.queryKey, exact: true })?.promise;
  return stop;
}

describe('locksQuery', () => {
  it("reads everyone's locks once for the Locks view and the lock marks of the pending changes", async () => {
    fakeApi.answer('locks.list', () => []);

    await show('everyone'); // the Locks view
    await show('everyone'); // the lock marks of Changes or Files

    expect(fakeApi.argsOf('locks.list')).toEqual([[place, repository, { onlyMine: false, onlyThisWorkspace: false }]]);
  });

  it("reads the user's locks in this workspace apart from the Locks view's \"only mine\": their records can't tell the workspace", async () => {
    fakeApi.answer('locks.list', () => []);

    await show('mine');
    await show('mineInThisWorkspace');

    expect(fakeApi.argsOf('locks.list')).toEqual([
      [place, repository, { onlyMine: true, onlyThisWorkspace: false }],
      [place, repository, { onlyMine: true, onlyThisWorkspace: true }],
    ]);
  });

  it('is read again, once, when locks are released or removed', async () => {
    fakeApi.answer('locks.list', () => []);
    await show('everyone');
    await show('everyone');

    await invalidateWorkspaceIn(client, ws, isAffectedByLocks);

    expect(fakeApi.argsOf('locks.list')).toHaveLength(2);
  });
});
