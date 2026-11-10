import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../../app/queryClient';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { applyDownloads } from './applyDownloads';

const ws = '/ws';

afterEach(() => queryClient.clear());

describe('applyDownloads', () => {
  it('downloads and removes what the user chose in one go, and refreshes the workspace like an update', async () => {
    fakeApi.answer('workspaces.configurePartial', () => undefined);
    const refreshed = watchRefreshes(ws);
    const rules = [
      { path: 'Assets', load: true },
      { path: 'readme.md', load: false },
    ];

    await expect(applyDownloads(ws, rules)).resolves.toBe(true);

    expect(fakeApi.argsOf('workspaces.configurePartial').map((args) => args.slice(0, 2))).toEqual([[ws, rules]]);
    expect(refreshed()).toContain('pendingChanges');
    expect(refreshed()).toContain('explorer');
    expect(shownToasts()).toContainEqual({ kind: 'success', title: 'Workspace has what you chose' });
  });

  it('says so when cm refuses, and changes nothing', async () => {
    fakeApi.answer('workspaces.configurePartial', () => {
      throw commandFailure('The item /Assets is not found');
    });

    await expect(applyDownloads(ws, [{ path: 'Assets', load: true }])).resolves.toBe(false);

    expect(shownToasts().map((toast) => toast.kind)).toContain('error');
  });
});
