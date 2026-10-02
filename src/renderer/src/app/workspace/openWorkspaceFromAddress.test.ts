import '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startingWorkspaceQuery } from '@shared/startingWorkspace';
import { useNavigation } from '../navigation/navigationStore';
import { queryClient } from '../queryClient';
import { openWorkspaceFromAddress } from './openWorkspaceFromAddress';
import { useSession } from './sessionStore';
import { folderMissingQuery } from './useWorkspace';

afterEach(() => {
  useSession.setState({ workspacePath: null });
  useNavigation.setState({ view: 'changes' });
  queryClient.clear();
});

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
    // Named only when its folder is there: the workspace screen shows at once, without asking again.
    expect(queryClient.getQueryData(folderMissingQuery('/work/game').queryKey)).toBe(false);
  });

  it('opens on Changes, or on the view a window reopened after an update showed', () => {
    openWorkspaceFromAddress(pageWith(startingWorkspaceQuery('/work/game')));
    expect(useNavigation.getState().view).toBe('changes');

    openWorkspaceFromAddress(pageWith(startingWorkspaceQuery('/work/game', 'branchExplorer')));
    expect(useNavigation.getState().view).toBe('branchExplorer');
  });

  it('opens on Changes when the view named is one this version no longer has', () => {
    openWorkspaceFromAddress(pageWith(startingWorkspaceQuery('/work/game', 'timeline')));

    expect(useNavigation.getState().view).toBe('changes');
  });

  it('stays on the home screen in a window opened for none', () => {
    const page = pageWith(startingWorkspaceQuery(undefined));

    openWorkspaceFromAddress(page);

    expect(useSession.getState().workspacePath).toBeNull();
    expect(page.history.replaceState).not.toHaveBeenCalled();
  });
});
