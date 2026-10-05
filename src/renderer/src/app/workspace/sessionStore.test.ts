import { afterEach, describe, expect, it } from 'vitest';
import { useSession } from './sessionStore';

afterEach(() => useSession.setState({ workspacePath: null, leftWorkspacePath: null }));

describe('the session', () => {
  it('remembers the workspace the window left for the home screen', () => {
    useSession.getState().openWorkspace('/ws');
    useSession.getState().closeWorkspace();

    expect(useSession.getState()).toMatchObject({ workspacePath: null, leftWorkspacePath: '/ws' });
  });

  it('keeps it while on the home screen, and takes the next one left', () => {
    useSession.getState().openWorkspace('/ws');
    useSession.getState().closeWorkspace();
    useSession.getState().closeWorkspace();
    expect(useSession.getState().leftWorkspacePath).toBe('/ws');

    useSession.getState().openWorkspace('/other');
    useSession.getState().closeWorkspace();
    expect(useSession.getState().leftWorkspacePath).toBe('/other');
  });

  it('has none in a window that started on the home screen', () => {
    expect(useSession.getState().leftWorkspacePath).toBeNull();
  });
});
