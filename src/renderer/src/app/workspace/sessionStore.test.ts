import { afterEach, describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { useSession } from './sessionStore';

afterEach(() => useSession.setState({ place: null, workspacePath: null, leftWorkspacePath: null }));

describe('the session', () => {
  it('remembers the workspace the window left for the home screen', () => {
    useSession.getState().openWorkspace('/ws');
    useSession.getState().goHome();

    expect(useSession.getState()).toMatchObject({ workspacePath: null, leftWorkspacePath: '/ws' });
  });

  it('keeps it while on the home screen, and takes the next one left', () => {
    useSession.getState().openWorkspace('/ws');
    useSession.getState().goHome();
    useSession.getState().goHome();
    expect(useSession.getState().leftWorkspacePath).toBe('/ws');

    useSession.getState().openWorkspace('/other');
    useSession.getState().goHome();
    expect(useSession.getState().leftWorkspacePath).toBe('/other');
  });

  it('has none in a window that started on the home screen', () => {
    expect(useSession.getState().leftWorkspacePath).toBeNull();
  });

  it('shows a workspace, or a repository explored without one, which has no workspace', () => {
    useSession.getState().openWorkspace('/ws');
    expect(useSession.getState()).toMatchObject({ place: workspacePlace('/ws'), workspacePath: '/ws' });

    useSession.getState().explore('game@local');
    expect(useSession.getState()).toMatchObject({ place: repositoryPlace('game@local'), workspacePath: null });
  });

  it('offers no way back to a repository explored: going home from one keeps the workspace left before', () => {
    useSession.getState().openWorkspace('/ws');
    useSession.getState().goHome();
    useSession.getState().explore('game@local');
    useSession.getState().goHome();

    expect(useSession.getState()).toMatchObject({ place: null, workspacePath: null, leftWorkspacePath: '/ws' });
  });
});
