import '../../testing/fakeWindow';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { workspacePlace } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';
import { createQueryClient } from '../../app/queryClient';
import { fakeApi } from '../../testing/fakeWindow';
import { readQuery, showOnce, showQuery } from '../../testing/queryProbes';
import { changesetOnScreen, changesetQuery } from './useChangeset';

const PLACE = workspacePlace('/ws');
const WHERE = { placeRepository: 'game@local' };
const changeset = (comment: string): Changeset => ({ id: 42, guid: 'g42', branch: '/main/task', comment, owner: 'ana', date: '2026-11-09T10:00:00Z', parent: 41, repository: 'game@local' });
// A branch's changesets, as "Changeset by changeset" lists them.
const BRANCH_LIST = queryKeys.inPlace(PLACE, 'changesets', { branch: '/main/task' });

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
  vi.useFakeTimers({ toFake: ['Date'] });
  fakeApi.answer('changesets.get', () => changeset('read alone'));
});
afterEach(() => {
  client.unmount();
  client.clear();
  vi.useRealTimers();
});

/** A view showing the changeset, as `useChangeset` reads it; stops showing it once its first read, if any, ends. */
async function showChangeset(): Promise<void> {
  await showOnce(client, changesetQuery(client, PLACE, 42, WHERE));
}

describe('a changeset read by its number (useChangeset)', () => {
  it('asks cm nothing for one a list on screen holds, even a stale list, which its own read refreshes', async () => {
    await showQuery(client, BRANCH_LIST, { answer: () => [changeset('listed')] });
    vi.advanceTimersByTime(60_000);

    await showChangeset();

    expect(fakeApi.argsOf('changesets.get')).toEqual([]);
  });

  it('reads one a stale list holds that no view shows any more: nothing would refresh it', async () => {
    await readQuery(client, BRANCH_LIST, { answer: () => [changeset('listed')] });
    vi.advanceTimersByTime(60_000);

    await showChangeset();

    expect(fakeApi.argsOf('changesets.get')).toHaveLength(1);
  });

  it('asks nothing for one a fresh list holds, as before', async () => {
    await readQuery(client, BRANCH_LIST, { answer: () => [changeset('listed')] });

    await showChangeset();

    expect(fakeApi.argsOf('changesets.get')).toEqual([]);
  });

  it("shows one a list on screen holds as that list's read again says, and stops following it once it leaves the screen", async () => {
    let reads = 0;
    const list = await showQuery(client, BRANCH_LIST, { answer: () => [changeset(++reads === 1 ? 'listed' : 'comment edited')] });
    expect(changesetOnScreen(client, PLACE, 42)?.comment).toBe('listed');

    await client.refetchQueries({ queryKey: BRANCH_LIST });
    expect(changesetOnScreen(client, PLACE, 42)?.comment).toBe('comment edited');

    list.hide();
    expect(changesetOnScreen(client, PLACE, 42)).toBeUndefined();
  });

  it("reads one under an xlink, another repository's, which the place's lists never hold", async () => {
    await showQuery(client, BRANCH_LIST, { answer: () => [changeset('listed')] });

    await showOnce(client, changesetQuery(client, PLACE, 42, { repository: 'assets@local', placeRepository: 'game@local' }));

    expect(fakeApi.argsOf('changesets.get')).toHaveLength(1);
  });
});
