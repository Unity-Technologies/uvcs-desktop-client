import '../../testing/fakeWindow';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queryKeys } from '../../api/queryKeys';
import { createQueryClient, IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../queryClient';
import { readQuery, showQuery } from '../../testing/queryProbes';
import { forgetWorkspace, workspaceLeft } from './leftWorkspace';

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

describe('workspaceLeft', () => {
  it('names the workspace the window showed before, once it shows another or the home screen', () => {
    expect(workspaceLeft('/wk/game', '/wk/tools')).toBe('/wk/game');
    expect(workspaceLeft('/wk/game', null)).toBe('/wk/game');
  });

  it('names none when the window still shows it, or showed none', () => {
    expect(workspaceLeft('/wk/game', '/wk/game')).toBeNull();
    expect(workspaceLeft(null, '/wk/game')).toBeNull();
    expect(workspaceLeft(null, null)).toBeNull();
  });
});

describe('forgetWorkspace', () => {
  it("drops the workspace's immutable results, revisions and what changesets changed, and nobody else's", async () => {
    const revision = queryKeys.inWorkspace('/wk/game', 'content', 'revid:12');
    const changesetFiles = queryKeys.inWorkspace('/wk/game', 'diffEntries', 'cs:4');
    const otherRevision = queryKeys.inWorkspace('/wk/game-tools', 'content', 'revid:12');
    for (const key of [revision, changesetFiles, otherRevision]) await readQuery(client, key, { meta: IMMUTABLE_QUERY, gcTime: Infinity });

    forgetWorkspace(client, '/wk/game');

    expect([cached(revision), cached(changesetFiles), cached(otherRevision)]).toEqual([false, false, true]);
  });

  it('keeps its lists and its info, so coming back within minutes reads nothing again', async () => {
    const info = queryKeys.inWorkspace('/wk/game', 'info');
    const branches = queryKeys.inWorkspace('/wk/game', 'branches', {});
    await readQuery(client, info);
    await readQuery(client, branches, SLOW_CHANGING_QUERY);

    forgetWorkspace(client, '/wk/game');

    expect([cached(info), cached(branches)]).toEqual([true, true]);
  });

  it('keeps an immutable result something still shows', async () => {
    const revision = queryKeys.inWorkspace('/wk/game', 'content', 'revid:12');
    await showQuery(client, revision, { meta: IMMUTABLE_QUERY });

    forgetWorkspace(client, '/wk/game');

    expect(cached(revision)).toBe(true);
  });
});
