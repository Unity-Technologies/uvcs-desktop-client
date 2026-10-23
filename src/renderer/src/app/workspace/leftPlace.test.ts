import '../../testing/fakeWindow';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queryKeys } from '../../api/queryKeys';
import { createQueryClient, IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../queryClient';
import { readQuery, showQuery } from '../../testing/queryProbes';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { forgetPlace, placeLeft } from './leftPlace';

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
});
afterEach(() => {
  client.unmount();
  client.clear();
});

const cached = (queryKey: readonly unknown[]): boolean => client.getQueryData(queryKey) !== undefined;

describe('placeLeft', () => {
  const game = workspacePlace('/wk/game');
  const explored = repositoryPlace('game@local');

  it('names the place the window showed before, once it shows another or the home screen', () => {
    expect(placeLeft(game, workspacePlace('/wk/tools'))).toEqual(game);
    expect(placeLeft(game, null)).toEqual(game);
    expect(placeLeft(explored, game)).toEqual(explored);
  });

  it('names none when the window still shows it, or showed none', () => {
    expect(placeLeft(game, workspacePlace('/wk/game'))).toBeNull();
    expect(placeLeft(explored, repositoryPlace('game@local'))).toBeNull();
    expect(placeLeft(null, game)).toBeNull();
    expect(placeLeft(null, null)).toBeNull();
  });
});

describe('forgetPlace', () => {
  it("drops the workspace's immutable results, revisions and what changesets changed, and nobody else's", async () => {
    const revision = queryKeys.inWorkspace('/wk/game', 'content', 'revid:12');
    const changesetFiles = queryKeys.inWorkspace('/wk/game', 'diffEntries', 'cs:4');
    const otherRevision = queryKeys.inWorkspace('/wk/game-tools', 'content', 'revid:12');
    for (const key of [revision, changesetFiles, otherRevision]) await readQuery(client, key, { meta: IMMUTABLE_QUERY, gcTime: Infinity });

    forgetPlace(client, workspacePlace('/wk/game'));

    expect([cached(revision), cached(changesetFiles), cached(otherRevision)]).toEqual([false, false, true]);
  });

  it('keeps its lists and its info, so coming back within minutes reads nothing again', async () => {
    const info = queryKeys.inWorkspace('/wk/game', 'info');
    const branches = queryKeys.inWorkspace('/wk/game', 'branches', {});
    await readQuery(client, info);
    await readQuery(client, branches, SLOW_CHANGING_QUERY);

    forgetPlace(client, workspacePlace('/wk/game'));

    expect([cached(info), cached(branches)]).toEqual([true, true]);
  });

  it("drops the contents its diffs read of the workspace's own files too, which a return reads again anyway", async () => {
    const file = { kind: 'workspaceFile', path: 'Assets/ship.fbx' };
    const keys = [
      queryKeys.inWorkspace('/wk/game', 'content', file),
      queryKeys.inWorkspace('/wk/game', 'contentBytes', file),
      queryKeys.inWorkspace('/wk/game', 'diffContents', { kind: 'revision', id: 12 }, file),
    ];
    for (const key of keys) await readQuery(client, key, { staleTime: 0, answer: () => ({ text: 'v 0 0 0' }) });

    forgetPlace(client, workspacePlace('/wk/game'));

    expect(keys.map(cached)).toEqual([false, false, false]);
  });

  it('keeps an immutable result something still shows', async () => {
    const revision = queryKeys.inWorkspace('/wk/game', 'content', 'revid:12');
    await showQuery(client, revision, { meta: IMMUTABLE_QUERY });

    forgetPlace(client, workspacePlace('/wk/game'));

    expect(cached(revision)).toBe(true);
  });

  it("drops a repository explored without a workspace's contents, and not a workspace's on it", async () => {
    const explored = queryKeys.inPlace(repositoryPlace('game@local'), 'content', 'revid:12');
    const inWorkspace = queryKeys.inWorkspace('/wk/game', 'content', 'revid:12');
    for (const key of [explored, inWorkspace]) await readQuery(client, key, { meta: IMMUTABLE_QUERY, gcTime: Infinity });

    forgetPlace(client, repositoryPlace('game@local'));

    expect([cached(explored), cached(inWorkspace)]).toEqual([false, true]);
  });
});
