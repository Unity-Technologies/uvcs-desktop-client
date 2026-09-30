import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { watchRefreshes } from '../../testing/operationOutcome';
import { notifyIncoming } from './incomingNotifications';
import { recheckIncoming } from './useIncomingSummary';

const ws = '/ws';

function workspaceOn(selector: WorkspaceInfo['selector'], loadedChangeset: number | null): void {
  const info: WorkspaceInfo = { name: 'game', path: ws, repository: 'game@local', repositoryName: 'game', server: 'local', selector, loadedChangeset };
  queryClient.setQueryData(queryKeys.inWorkspace(ws, 'info'), info);
}

const behind = (headChangeset: number, changesetCount: number, loadedChangeset = 10): IncomingSummary => ({
  branch: '/main',
  loadedChangeset,
  headChangeset,
  changesetCount,
  authors: ['ana'],
});

/** `merge.incomingSummary` answers each check with the next summary. */
function serverAnswers(...summaries: IncomingSummary[]): void {
  fakeApi.answer('merge.incomingSummary', () => summaries.shift());
}

/** The notification the window sends the OS, once it does. */
function notificationSent(): Promise<unknown[]> {
  return new Promise((resolve) => fakeApi.answer('system.notifyIncoming', (...args: unknown[]) => resolve(args)));
}

afterEach(() => vi.restoreAllMocks());

describe('recheckIncoming', () => {
  it('asks the server where the branch head is from where the workspace info says it stands', async () => {
    workspaceOn({ kind: 'branch', name: '/main' }, 10);
    serverAnswers(behind(12, 2));

    expect(await recheckIncoming(ws)).toEqual(behind(12, 2));

    expect(fakeApi.argsOf('merge.incomingSummary')).toEqual([[ws, { branch: '/main', loadedChangeset: 10 }]]);
  });

  it('asks about no branch for a workspace on a shelve, a label or a changeset', async () => {
    workspaceOn({ kind: 'shelve', name: '3' }, null);
    serverAnswers({ branch: null, changesetCount: 0 } as IncomingSummary);

    await recheckIncoming(ws);

    expect(fakeApi.argsOf('merge.incomingSummary')).toEqual([[ws, null]]);
  });

  it('asks nothing while the workspace info is unknown', async () => {
    expect(await recheckIncoming(ws)).toBeUndefined();
    expect(fakeApi.methods()).toEqual([]);
  });

  it("refreshes the repository views when someone else's checkin moved the head, not the workspace's own lists", async () => {
    workspaceOn({ kind: 'branch', name: '/main' }, 10);
    serverAnswers(behind(12, 2), behind(13, 3));
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    await recheckIncoming(ws);
    const refreshed = watchRefreshes(ws);
    workspaceOn({ kind: 'branch', name: '/main' }, 10);

    await recheckIncoming(ws);

    expect(refreshed()).toEqual(['branchExplorer', 'branches', 'changesets', 'history', 'incoming', 'locks']);
  });

  it('refreshes nothing when the head stayed, or when the workspace moved itself', async () => {
    workspaceOn({ kind: 'branch', name: '/main' }, 10);
    serverAnswers(behind(12, 2), behind(12, 2), behind(12, 0, 12));
    await recheckIncoming(ws);
    const refreshed = watchRefreshes(ws);
    workspaceOn({ kind: 'branch', name: '/main' }, 10);

    await recheckIncoming(ws);
    workspaceOn({ kind: 'branch', name: '/main' }, 12);
    await recheckIncoming(ws);

    expect(refreshed()).toEqual([]);
  });
});

describe('notifyIncoming', () => {
  const settings = (notifyOnIncoming: boolean) => fakeApi.answer('settings.get', () => ({ ...DEFAULT_SETTINGS, notifyOnIncoming }));

  it('tells the OS who checked in what, while the window is in the background and the setting is on', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    settings(true);
    fakeApi.answer('changesets.get', () => ({ id: 13, owner: 'ana.diaz@example.com', comment: 'Faster login\nmore' }));
    const sent = notificationSent();

    await notifyIncoming(ws, behind(12, 2), behind(14, 4));

    expect(await sent).toEqual([ws, "Ana Diaz checked in 'Faster login' on /main (and 1 more)"]);
    expect(fakeApi.argsOf('changesets.get')).toEqual([[ws, 14]]);
  });

  it('stays quiet with the setting off, the window focused, or no new head', async () => {
    const focused = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    settings(false);
    await notifyIncoming(ws, behind(12, 2), behind(14, 4));
    expect(fakeApi.methods()).toEqual(['settings.get']);

    queryClient.clear();
    settings(true);
    focused.mockReturnValue(true);
    await notifyIncoming(ws, behind(12, 2), behind(14, 4));
    focused.mockReturnValue(false);
    await notifyIncoming(ws, behind(14, 4), behind(14, 4));
    expect(fakeApi.methods()).toEqual(['settings.get']);
  });

  it('gives up quietly when the newest changeset cannot be read', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    settings(true);
    fakeApi.answer('changesets.get', () => {
      throw new Error('offline');
    });

    await expect(notifyIncoming(ws, behind(12, 2), behind(14, 4))).resolves.toBeUndefined();
  });
});
