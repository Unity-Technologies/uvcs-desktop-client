import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { rememberRecentBranch } from '../branches/recentBranches';
import { listedChangeset } from '../changesets/useChangeset';

// The xlink dialog's pickers read the xlinked repository's lists into the same window as the workspace's: what reads
// the workspace's lists from the cache must never take one of theirs, whose ids and GUIDs are another repository's.
const ws = '/ws';

afterEach(() => queryClient.clear());

describe("An xlinked repository's lists, read by the xlink dialog's pickers", () => {
  it("never answer for the workspace's changesets", () => {
    const libChangeset = { id: 4, comment: 'Gravity', repository: 'lib@local' } as Changeset;
    queryClient.setQueryData(queryKeys.inPlace(repositoryPlace('lib@local'), 'changesets', { limit: 2000 }), [libChangeset]);

    expect(listedChangeset(workspacePlace(ws), 4)).toBeUndefined();
  });

  it("never answer for the workspace's branches, as a switch remembers one among the recent", async () => {
    const libMain = { name: '/main', guid: 'lib-main', repository: 'lib@local' } as Branch;
    queryClient.setQueryData(queryKeys.inPlace(repositoryPlace('lib@local'), 'branches', {}), [libMain]);
    fakeApi.answer('branches.get', () => ({ name: '/main', guid: 'game-main', repository: 'game@local' }));
    fakeApi.answer('branches.rememberRecent', () => undefined);
    fakeApi.answer('branches.recent', () => []);

    await rememberRecentBranch(ws, '/main');

    expect(fakeApi.calls().find((call) => call.method === 'branches.rememberRecent')?.args).toEqual([ws, 'game-main']);
  });
});
