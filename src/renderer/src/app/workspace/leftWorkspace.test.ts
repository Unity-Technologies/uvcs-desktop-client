import '../../testing/fakeWindow';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queryKeys } from '../../api/queryKeys';
import { createQueryClient, IMMUTABLE_QUERY } from '../queryClient';
import { readQuery } from '../../testing/queryProbes';
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
  it("drops every query of the workspace left, immutable revisions too, and keeps the others' and the app's", async () => {
    const revision = queryKeys.inWorkspace('/wk/game', 'diffContents', 'revid:12', 'revid:13');
    const info = queryKeys.inWorkspace('/wk/game', 'info');
    const otherInfo = queryKeys.inWorkspace('/wk/game-tools', 'info');
    await readQuery(client, revision, { meta: IMMUTABLE_QUERY, gcTime: Infinity });
    await readQuery(client, info);
    await readQuery(client, otherInfo);
    await readQuery(client, queryKeys.workspaces);

    forgetWorkspace(client, '/wk/game');

    expect([cached(revision), cached(info), cached(otherInfo), cached(queryKeys.workspaces)]).toEqual([false, false, true, true]);
  });
});
