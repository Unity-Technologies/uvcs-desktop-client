import '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';

import { showQuery, type QueryProbe } from '../../testing/queryProbes';
import { IMMUTABLE_QUERY, keyedByWorkspaceInfo, queryClient } from '../queryClient';
import { affectedByChange, HeldChanges, localQueryDefaults, refreshForChange } from './workspaceChangeRefresh';

const ws = '/ws';
const unsubscribers: (() => void)[] = [];

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  queryClient.clear();
});

const change = (parts: Partial<WorkspaceChange>): WorkspaceChange => ({ content: false, pathsChanged: false, metadata: false, folders: null, ...parts });

function info(branch: string, loadedChangeset = 10): WorkspaceInfo {
  return { selector: { kind: 'branch', name: branch }, loadedChangeset } as WorkspaceInfo;
}

/** A query on screen, already read once; counts its reads. */
async function shown(queryKey: unknown[], { meta, read }: { meta?: Record<string, unknown>; read?: () => unknown } = {}): Promise<QueryProbe> {
  const probe = await showQuery(queryClient, queryKey, { staleTime: Infinity, meta, ...(read && { answer: read }) });
  unsubscribers.push(probe.hide);
  return probe;
}

/** Reads of each query after the refresh, less the first read that showed it. */
function refetches(queries: Record<string, QueryProbe>): Record<string, number> {
  return Object.fromEntries(Object.entries(queries).map(([name, probe]) => [name, probe.reads() - 1]));
}

async function workspaceViews(infoRead: () => WorkspaceInfo = () => info('/main')) {
  return {
    info: await shown(['workspace', ws, 'info'], { read: infoRead }),
    pendingChanges: await shown(['workspace', ws, 'pendingChanges']),
    srcListing: await shown(['workspace', ws, 'explorer', 'directory', 'src']),
    rootListing: await shown(['workspace', ws, 'explorer', 'directory', '']),
    docsListing: await shown(['workspace', ws, 'explorer', 'directory', 'docs']),
    allPaths: await shown(['workspace', ws, 'explorer', 'allPaths']),
    branches: await shown(['workspace', ws, 'branches', {}]),
    otherWorkspace: await shown(['workspace', '/other', 'pendingChanges']),
  };
}

describe('refreshForChange', () => {
  it('re-reads the pending changes and the listings of the folders edited and above them, on file edits', async () => {
    const views = await workspaceViews();

    await refreshForChange(ws, change({ content: true, folders: ['src'] }), true);

    expect(refetches(views)).toEqual({ info: 0, pendingChanges: 1, srcListing: 1, rootListing: 1, docsListing: 0, allPaths: 0, branches: 0, otherWorkspace: 0 });
  });

  it('re-reads every open listing when the edits could be anywhere', async () => {
    const views = await workspaceViews();

    await refreshForChange(ws, change({ content: true, folders: null }), true);

    expect(refetches(views)).toMatchObject({ srcListing: 1, rootListing: 1, docsListing: 1, branches: 0 });
  });

  it('leaves file edits alone while automatic refresh is off', async () => {
    const views = await workspaceViews();

    await refreshForChange(ws, change({ content: true, folders: ['src'] }), false);

    expect(Object.values(refetches(views))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('re-reads the paths list only when items came or went', async () => {
    const views = await workspaceViews();

    await refreshForChange(ws, change({ pathsChanged: true }), false);

    expect(refetches(views)).toMatchObject({ allPaths: 1, pendingChanges: 0 });
  });

  it('re-reads the workspace info and pending changes on a .plastic rewrite, even with automatic refresh off', async () => {
    const views = await workspaceViews();

    await refreshForChange(ws, change({ metadata: true }), false);

    expect(refetches(views)).toEqual({ info: 1, pendingChanges: 1, srcListing: 0, rootListing: 0, docsListing: 0, allPaths: 0, branches: 0, otherWorkspace: 0 });
  });

  it('refreshes every view once when the rewrite moved the loaded branch, but immutable results', async () => {
    let branch = '/main';
    const views = await workspaceViews(() => info(branch));
    const changesetFiles = await shown(['workspace', ws, 'changesets', 'byId', 5], { meta: IMMUTABLE_QUERY });
    branch = '/main/task';

    await refreshForChange(ws, change({ metadata: true }), true);

    expect(refetches({ ...views, changesetFiles })).toEqual({
      info: 1,
      pendingChanges: 1,
      srcListing: 1,
      rootListing: 1,
      docsListing: 1,
      allPaths: 1,
      branches: 1,
      otherWorkspace: 0,
      changesetFiles: 0,
    });
  });

  it('only marks stale the views keyed by what moved: they are read under their new key as they show', async () => {
    let branch = '/main';
    await shown(['workspace', ws, 'info'], { read: () => info(branch) });
    const keyedBySelector = await shown(['workspace', ws, 'leftChanges', '/main'], { meta: keyedByWorkspaceInfo('selector') });
    const keyedByChangeset = await shown(['workspace', ws, 'incoming', 10], { meta: keyedByWorkspaceInfo('loadedChangeset') });
    branch = '/main/task';

    await refreshForChange(ws, change({ metadata: true }), true);

    expect(refetches({ keyedBySelector, keyedByChangeset })).toEqual({ keyedBySelector: 0, keyedByChangeset: 0 });
    expect(queryClient.getQueryState(['workspace', ws, 'leftChanges', '/main'])?.isInvalidated).toBe(true);
  });

  it('re-reads views keyed by a part of the workspace info that did not move', async () => {
    let loaded = 10;
    await shown(['workspace', ws, 'info'], { read: () => info('/main', loaded) });
    const keyedBySelector = await shown(['workspace', ws, 'leftChanges', '/main'], { meta: keyedByWorkspaceInfo('selector') });
    loaded = 11;

    await refreshForChange(ws, change({ metadata: true }), true);

    expect(refetches({ keyedBySelector })).toEqual({ keyedBySelector: 1 });
  });
});

describe('affectedByChange', () => {
  it('picks nothing for a change that changed nothing', () => {
    const affected = affectedByChange(change({}), true);

    expect(affected(['workspace', ws, 'pendingChanges'])).toBe(false);
    expect(affected(['workspace', ws, 'info'])).toBe(false);
  });
});

describe('localQueryDefaults', () => {
  it('skips the focus refetch of local views only while the watcher sees everything and auto refresh is on', () => {
    expect(localQueryDefaults('pendingChanges', true, 'full').refetchOnWindowFocus).toBe(false);
    expect(localQueryDefaults('pendingChanges', true, 'partial').refetchOnWindowFocus).toBe(true);
    expect(localQueryDefaults('pendingChanges', false, 'full').refetchOnWindowFocus).toBe(true);
  });

  it('keeps the workspace info fresh for good while the watcher sees every .plastic rewrite', () => {
    expect(localQueryDefaults('info', false, 'full').staleTime).toBe(Infinity);
    expect(localQueryDefaults('info', true, 'partial').staleTime).toBeUndefined();
    expect(localQueryDefaults('pendingChanges', true, 'full').staleTime).toBeUndefined();
  });
});

describe('HeldChanges', () => {
  it('keeps the changes seen while hidden as one', () => {
    const held = new HeldChanges();
    held.hold(ws, change({ content: true, folders: ['src'] }));
    held.hold(ws, change({ metadata: true, folders: ['docs'] }));

    expect(held.take(ws)).toEqual(change({ content: true, metadata: true, folders: ['src', 'docs'] }));
  });

  it('gives what it held once', () => {
    const held = new HeldChanges();
    held.hold(ws, change({ content: true }));
    held.take(ws);

    expect(held.take(ws)).toBeNull();
  });

  it('drops changes held for another workspace than the one shown now', () => {
    const held = new HeldChanges();
    held.hold('/old', change({ content: true }));

    expect(held.take(ws)).toBeNull();
    expect(held.take('/old')).toBeNull();
  });

  it('starts over when a change comes from another workspace', () => {
    const held = new HeldChanges();
    held.hold('/old', change({ metadata: true }));
    held.hold(ws, change({ content: true }));

    expect(held.take(ws)).toEqual(change({ content: true }));
  });
});
