import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startingPlaceQuery } from '@shared/startingPlace';
import { useNavigation } from '../navigation/navigationStore';
import { queryClient } from '../queryClient';
import { openPlaceFromAddress } from './openPlaceFromAddress';
import { useSession } from './sessionStore';
import { folderMissingQuery } from './useWorkspace';

afterEach(() => {
  useSession.setState({ place: null, workspacePath: null });
  useNavigation.setState({ view: 'changes' });
  queryClient.clear();
});

/** A page loaded from `index.html` with the query the main process gave it; replacing its address drops the query, as a browser does. */
function pageWith(query: Record<string, string>) {
  const location = { search: Object.keys(query).length > 0 ? `?${new URLSearchParams(query)}` : '', pathname: '/app/out/renderer/index.html' };
  const replaceState = vi.fn((_state: unknown, _unused: string, url: string) => void Object.assign(location, { search: '', pathname: url }));
  return { location, history: { replaceState } };
}

describe('openPlaceFromAddress', () => {
  it('opens the workspace the window was opened for, and the address forgets it for a reload', () => {
    const page = pageWith(startingPlaceQuery(workspacePlace('/work/game')));

    openPlaceFromAddress(page);

    expect(useSession.getState().workspacePath).toBe('/work/game');
    expect(page.history.replaceState).toHaveBeenCalledWith(null, '', '/app/out/renderer/index.html');
    // Named only when its folder is there: the workspace screen shows at once, without asking again.
    expect(queryClient.getQueryData(folderMissingQuery('/work/game').queryKey)).toBe(false);
  });

  it('opens on Changes, or on the view a window reopened after an update showed', () => {
    openPlaceFromAddress(pageWith(startingPlaceQuery(workspacePlace('/work/game'))));
    expect(useNavigation.getState().view).toBe('changes');

    openPlaceFromAddress(pageWith(startingPlaceQuery(workspacePlace('/work/game'), 'branchExplorer')));
    expect(useNavigation.getState().view).toBe('branchExplorer');
  });

  it('opens on Changes when the view named is one this version no longer has', () => {
    openPlaceFromAddress(pageWith(startingPlaceQuery(workspacePlace('/work/game'), 'timeline')));

    expect(useNavigation.getState().view).toBe('changes');
  });

  it('explores a repository the window was opened for, on its first view or the one it showed if it has it', () => {
    openPlaceFromAddress(pageWith(startingPlaceQuery(repositoryPlace('game@local'))));
    expect(useSession.getState()).toMatchObject({ place: repositoryPlace('game@local'), workspacePath: null });
    expect(useNavigation.getState().view).toBe('branchExplorer');

    openPlaceFromAddress(pageWith(startingPlaceQuery(repositoryPlace('game@local'), 'labels')));
    expect(useNavigation.getState().view).toBe('labels');

    // A workspace's view, which a repository doesn't show.
    openPlaceFromAddress(pageWith(startingPlaceQuery(repositoryPlace('game@local'), 'changes')));
    expect(useNavigation.getState().view).toBe('branchExplorer');
  });

  it('stays on the home screen in a window opened for none', () => {
    const page = pageWith(startingPlaceQuery(undefined));

    openPlaceFromAddress(page);

    expect(useSession.getState().workspacePath).toBeNull();
    expect(page.history.replaceState).not.toHaveBeenCalled();
  });
});
