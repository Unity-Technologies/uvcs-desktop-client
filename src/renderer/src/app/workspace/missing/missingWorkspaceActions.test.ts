import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uvcs = await vi.hoisted(async () => (await import('../../../lib/testing/fakeWindow')).installFakeWindow());

import { queryKeys } from '../../../api/queryKeys';
import { useToastStore } from '../../../ui/toast/toastStore';
import { queryClient } from '../../queryClient';
import { useSession } from '../sessionStore';
import { forgetMissingWorkspace, locateWorkspace } from './missingWorkspaceActions';

const callOf = (method: string) => uvcs.calls.find((call) => call.method === method);

beforeEach(() => {
  uvcs.reset();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => queryClient.clear());

describe('locateWorkspace', () => {
  it('asks where the workspace went, starting next to where it was', async () => {
    uvcs.answerWith({ 'system.pickDirectory': null });

    await locateWorkspace('game', '/projects/game', () => {});

    expect(callOf('system.pickDirectory')?.args).toEqual(['Where is “game” now?', '/projects']);
  });

  it('does nothing more when the user cancels the picker', async () => {
    uvcs.answerWith({ 'system.pickDirectory': null });
    const open = vi.fn();

    await locateWorkspace('game', '/projects/game', open);

    expect(uvcs.methodsCalled()).toEqual(['system.pickDirectory']);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the workspace found at the folder picked, forgetting where it was', async () => {
    uvcs.answerWith({ 'system.pickDirectory': '/moved/game/Assets', 'workspaces.findRoot': '/moved/game', 'settings.forgetRecentWorkspace': {} });
    queryClient.setQueryData(queryKeys.workspaces, []);
    const open = vi.fn();

    await locateWorkspace('game', '/projects/game', open);

    expect(callOf('settings.forgetRecentWorkspace')?.args).toEqual(['/projects/game']);
    expect(open).toHaveBeenCalledWith('/moved/game');
    expect(queryClient.getQueryState(queryKeys.workspaces)?.isInvalidated).toBe(true);
  });

  it('says so, and remembers the old place, when the folder picked is no workspace', async () => {
    uvcs.answerWith({ 'system.pickDirectory': '/elsewhere', 'workspaces.findRoot': null });
    const open = vi.fn();

    await locateWorkspace('game', '/projects/game', open);

    expect(open).not.toHaveBeenCalled();
    expect(uvcs.methodsCalled()).not.toContain('settings.forgetRecentWorkspace');
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ kind: 'error', title: "That folder isn't a workspace", detail: 'Choose the folder “game” was moved to.' }),
    ]);
  });
});

describe('forgetMissingWorkspace', () => {
  it('drops it from the recent workspaces and goes back to the home screen', async () => {
    useSession.setState({ workspacePath: '/projects/game' });

    await forgetMissingWorkspace('/projects/game');

    expect(callOf('settings.forgetRecentWorkspace')?.args).toEqual(['/projects/game']);
    expect(useSession.getState().workspacePath).toBeNull();
  });
});
