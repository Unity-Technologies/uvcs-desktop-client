import '../testing/fakeWindow';
import { focusManager, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceInfo } from '@shared/domain/workspace';

import { queryKeys } from '../api/queryKeys';
import {
  createQueryClient,
  IMMUTABLE_QUERY,
  invalidateWorkspaceIn,
  keyedByWorkspaceInfo,
  MAX_UNUSED_IMMUTABLE,
  MAX_UNUSED_IMMUTABLE_BYTES,
  SLOW_CHANGING_QUERY,
} from './queryClient';
import { readQuery, showQuery } from '../testing/queryProbes';

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

  it("marks the lists of workspaces' heads stale when the workspace moved to another branch, without reading them", async () => {
    await showWorkspaceInfo(workspaceOn('/main', 10), workspaceOn('/main/task', 10));
    const heads = await showQuery(client, queryKeys.workspaceHeads(['/work/game', '/work/tools']));

    await invalidateWorkspaceIn(client, ws);

    expect(heads.reads()).toBe(1);
    expect(isStale(queryKeys.workspaceHeads(['/work/game', '/work/tools']))).toBe(true);
  });

  it("leaves the lists of workspaces' heads alone when the workspace stayed on its branch", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await showWorkspaceInfo(workspaceOn('/main', 10), workspaceOn('/main', 11));
    await showQuery(client, queryKeys.workspaceHeads(['/work/game']), { staleTime: 5 * 60_000 });

    await invalidateWorkspaceIn(client, ws);

    expect(isStale(queryKeys.workspaceHeads(['/work/game']))).toBe(false);
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

  it('forgets the oldest files once those kept hold more than their bytes allow: a few models, not a hundred', async () => {
    // Bytes that only say their length: a third of the bound and a little more each, allocated by no test.
    const model = (id: number) => ({ model: { bytes: { byteLength: MAX_UNUSED_IMMUTABLE_BYTES / 3 + id }, format: 'glb' }, isBinary: true, size: 0 });
    for (let id = 0; id < 4; id++) await readQuery(client, key('content', { kind: 'revision', id }), { meta: IMMUTABLE_QUERY, answer: () => model(id) });

    const cached = (id: number) => client.getQueryData(key('content', { kind: 'revision', id })) !== undefined;
    expect([0, 1, 2, 3].map(cached)).toEqual([false, false, true, true]);
  });

  it("counts images by their bytes and texts by their length, not models alone: a changeset's big images and a long text", async () => {
    // A fifth of the bound and a little more each image; a text three tenths, its diff's two sides the same text.
    const image = (id: number) => ({ image: { bytes: { byteLength: MAX_UNUSED_IMMUTABLE_BYTES / 5 + id }, mimeType: 'image/png' }, isBinary: true, size: 0 });
    const text = { text: { length: (MAX_UNUSED_IMMUTABLE_BYTES * 3) / 10 }, isBinary: false, size: 0 };
    const revision = (id: number) => key('content', { kind: 'revision', id });
    for (let id = 1; id <= 4; id++) await readQuery(client, revision(id), { meta: IMMUTABLE_QUERY, answer: () => image(id) });
    await readQuery(client, key('diffContents', 'before', 'after'), { meta: IMMUTABLE_QUERY, answer: () => ({ left: text, right: text }) });
    await readQuery(client, revision(5), { meta: IMMUTABLE_QUERY, answer: () => image(5) });

    const cached = (queryKey: readonly unknown[]) => client.getQueryData(queryKey) !== undefined;
    expect([1, 2, 3, 4, 5].map((id) => cached(revision(id)))).toEqual([false, false, true, true, true]);
    expect(cached(key('diffContents', 'before', 'after'))).toBe(true);
  });
});
