import '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startingWorkspaceQuery } from '@shared/startingWorkspace';
import { openWorkspaceFromAddress } from './openWorkspaceFromAddress';
import { useSession } from './sessionStore';

afterEach(() => useSession.setState({ workspacePath: null }));

/** A page loaded from `index.html` with the query the main process gave it. */
function pageWith(query: Record<string, string>) {
  const search = Object.keys(query).length > 0 ? `?${new URLSearchParams(query)}` : '';
  return { location: { search, pathname: '/app/out/renderer/index.html' }, history: { replaceState: vi.fn() } };
}

describe('openWorkspaceFromAddress', () => {
  it('opens the workspace the window was opened for, and the address forgets it for a reload', () => {
    const page = pageWith(startingWorkspaceQuery('/work/game'));

    openWorkspaceFromAddress(page);

    expect(useSession.getState().workspacePath).toBe('/work/game');
    expect(page.history.replaceState).toHaveBeenCalledWith(null, '', '/app/out/renderer/index.html');
  });

  it('stays on the home screen in a window opened for none', () => {
    const page = pageWith(startingWorkspaceQuery(undefined));

    openWorkspaceFromAddress(page);

    expect(useSession.getState().workspacePath).toBeNull();
    expect(page.history.replaceState).not.toHaveBeenCalled();
  });
});
