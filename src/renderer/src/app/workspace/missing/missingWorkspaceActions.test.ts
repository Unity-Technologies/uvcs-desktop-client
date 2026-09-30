import { fakeApi } from '../../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../api/queryKeys';
import { shownToasts } from '../../../testing/operationOutcome';
import { queryClient } from '../../queryClient';
import { useSession } from '../sessionStore';
import { forgetMissingWorkspace, locateWorkspace } from './missingWorkspaceActions';

const callOf = (method: string) => fakeApi.calls().find((call) => call.method === method);

afterEach(() => queryClient.clear());

describe('locateWorkspace', () => {
  it('asks where the workspace went, starting next to where it was', async () => {
    fakeApi.answer('system.pickDirectory', () => null);

    await locateWorkspace('game', '/projects/game', () => {});

    expect(callOf('system.pickDirectory')?.args).toEqual(['Where is “game” now?', '/projects']);
  });

  it('does nothing more when the user cancels the picker', async () => {
    fakeApi.answer('system.pickDirectory', () => null);
    const open = vi.fn();

    await locateWorkspace('game', '/projects/game', open);

    expect(fakeApi.methods()).toEqual(['system.pickDirectory']);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the workspace found at the folder picked, forgetting where it was', async () => {
    fakeApi.answer('system.pickDirectory', () => '/moved/game/Assets');
    fakeApi.answer('workspaces.findRoot', () => '/moved/game');
    fakeApi.answer('settings.forgetRecentWorkspace', () => ({}));
    queryClient.setQueryData(queryKeys.workspaces, []);
    const open = vi.fn();

    await locateWorkspace('game', '/projects/game', open);

    expect(callOf('settings.forgetRecentWorkspace')?.args).toEqual(['/projects/game']);
    expect(open).toHaveBeenCalledWith('/moved/game');
    expect(queryClient.getQueryState(queryKeys.workspaces)?.isInvalidated).toBe(true);
  });

  it('says so, and remembers the old place, when the folder picked is no workspace', async () => {
    fakeApi.answer('system.pickDirectory', () => '/elsewhere');
    fakeApi.answer('workspaces.findRoot', () => null);
    const open = vi.fn();

    await locateWorkspace('game', '/projects/game', open);

    expect(open).not.toHaveBeenCalled();
    expect(fakeApi.methods()).not.toContain('settings.forgetRecentWorkspace');
    expect(shownToasts()).toEqual([{ kind: 'error', title: "That folder isn't a workspace", detail: 'Choose the folder “game” was moved to.' }]);
  });
});

describe('forgetMissingWorkspace', () => {
  it('drops it from the recent workspaces and goes back to the home screen', async () => {
    useSession.setState({ workspacePath: '/projects/game' });
    fakeApi.answer('settings.forgetRecentWorkspace', () => ({}));

    await forgetMissingWorkspace('/projects/game');

    expect(callOf('settings.forgetRecentWorkspace')?.args).toEqual(['/projects/game']);
    expect(useSession.getState().workspacePath).toBeNull();
  });
});
