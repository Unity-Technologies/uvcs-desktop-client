import { focusManager, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceInfo } from '@shared/domain/workspace';

await vi.hoisted(async () => (await import('../lib/testing/fakeWindow')).installFakeWindow());

import { queryKeys } from '../api/queryKeys';
import {
  createQueryClient,
  IMMUTABLE_QUERY,
  invalidateWorkspaceIn,
  keyedByWorkspaceInfo,
  MAX_UNUSED_IMMUTABLE,
  SLOW_CHANGING_QUERY,
} from './queryClient';
import { readQuery, showQuery } from './testing/queryProbes';

const ws = '/work/game';
const key = (...parts: unknown[]) => queryKeys.inWorkspace(ws, ...parts);

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
});
afterEach(() => {
  client.unmount();
  client.clear();
  vi.useRealTimers();
});

function workspaceOn(branch: string, loadedChangeset: number): WorkspaceInfo {
  return { name: 'game', path: ws, repository: 'game@local', repositoryName: 'game', server: 'local', selector: { kind: 'branch', name: branch }, loadedChangeset };
}

/** The workspace info on screen, which reads `after` from the next read on (the operation moved the workspace). */
function showWorkspaceInfo(before: WorkspaceInfo, after: WorkspaceInfo = before) {
  return showQuery(client, key('info'), { answer: (read) => (read === 1 ? before : after) });
}

const isStale = (queryKey: readonly unknown[]) => client.getQueryCache().find({ queryKey, exact: true })?.isStale();

describe('invalidateWorkspace', () => {
  it('re-reads the views of the workspace on screen and only marks the others stale', async () => {
    const shown = await showQuery(client, key('branches'));
    const offScreen = await readQuery(client, key('labels'));

    await invalidateWorkspaceIn(client, ws);

    expect(shown.reads()).toBe(2);
    expect(offScreen.reads()).toBe(1);
    expect(isStale(key('labels'))).toBe(true);
  });

  it('leaves other workspaces and immutable results alone', async () => {
    const otherWorkspace = await showQuery(client, queryKeys.inWorkspace('/work/other', 'branches'));
    const changesetFiles = await showQuery(client, key('changesets', 'diff', 12), { meta: IMMUTABLE_QUERY });

    await invalidateWorkspaceIn(client, ws);

    expect(otherWorkspace.reads()).toBe(1);
    expect(changesetFiles.reads()).toBe(1);
  });

  it('refreshes only what the operation affects', async () => {
    const branches = await showQuery(client, key('branches'));
    const labels = await showQuery(client, key('labels'));

    await invalidateWorkspaceIn(client, ws, (queryKey) => queryKey[2] === 'branches');

    expect([branches.reads(), labels.reads()]).toEqual([2, 1]);
    expect(isStale(key('labels'))).toBe(false);
  });

  it('only marks stale a view keyed by the part of the workspace info the operation moved: it is read under its new key', async () => {
    await showWorkspaceInfo(workspaceOn('/main', 10), workspaceOn('/main/task', 11));
    const leftChanges = await showQuery(client, key('leftChanges', '/main'), { meta: keyedByWorkspaceInfo('selector') });
    const incoming = await showQuery(client, key('incoming', 10), { meta: keyedByWorkspaceInfo('loadedChangeset') });

    await invalidateWorkspaceIn(client, ws);

    expect([leftChanges.reads(), incoming.reads()]).toEqual([1, 1]);
    expect(isStale(key('leftChanges', '/main'))).toBe(true);
  });

  it('re-reads a view keyed by a part of the workspace info that stayed', async () => {
    await showWorkspaceInfo(workspaceOn('/main', 10), workspaceOn('/main', 11));
    const leftChanges = await showQuery(client, key('leftChanges', '/main'), { meta: keyedByWorkspaceInfo('selector') });
    const incoming = await showQuery(client, key('incoming', 10), { meta: keyedByWorkspaceInfo('loadedChangeset') });

    await invalidateWorkspaceIn(client, ws);

    expect([leftChanges.reads(), incoming.reads()]).toEqual([2, 1]);
  });

  it('waits for the workspace info before refreshing the views keyed by it', async () => {
    let finishInfo = () => {};
    const info = workspaceOn('/main', 10);
    await showQuery(client, key('info'), { answer: (read) => (read === 1 ? info : new Promise((resolve) => (finishInfo = () => resolve(info)))) });
    const leftChanges = await showQuery(client, key('leftChanges', '/main'), { meta: keyedByWorkspaceInfo('selector') });

    const refreshed = invalidateWorkspaceIn(client, ws);
    await Promise.resolve();
    expect(leftChanges.reads()).toBe(1);

    finishInfo();
    await refreshed;
    expect(leftChanges.reads()).toBe(2);
  });
});

describe('coming back to the window', () => {
  /** The user comes back to the window; resolves once the client has handled it (it resumes paused mutations first). */
  const focus = async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => focusManager.setFocused(undefined));

  it('re-reads a view on screen once it is older than 30 s', async () => {
    const branches = await showQuery(client, key('branches'));

    vi.advanceTimersByTime(29_000);
    await focus();
    expect(branches.reads()).toBe(1);

    vi.advanceTimersByTime(2_000);
    await focus();
    expect(branches.reads()).toBe(2);
  });

  it('never re-reads a slow-changing list, however old', async () => {
    const everyBranch = await showQuery(client, key('branches', {}), SLOW_CHANGING_QUERY);

    vi.advanceTimersByTime(60 * 60_000);
    await focus();

    expect(everyBranch.reads()).toBe(1);
  });
});

describe('immutable results off screen', () => {
  it(`keeps the last ${MAX_UNUSED_IMMUTABLE} and forgets older ones, while other results stay`, async () => {
    for (let id = 0; id <= MAX_UNUSED_IMMUTABLE; id++) await readQuery(client, key('changesets', 'diff', id), { meta: IMMUTABLE_QUERY });
    await readQuery(client, key('branches'));

    const cached = (queryKey: readonly unknown[]) => client.getQueryData(queryKey) !== undefined;
    expect(cached(key('changesets', 'diff', 0))).toBe(false);
    expect(cached(key('changesets', 'diff', 1))).toBe(true);
    expect(cached(key('changesets', 'diff', MAX_UNUSED_IMMUTABLE))).toBe(true);
    expect(cached(key('branches'))).toBe(true);
  });
});
