import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { repositoryPlace } from '@shared/domain/place';
import { useNavigation } from '../navigation/navigationStore';
import { exploreHere, exploreRepository } from './exploreRepository';
import { useSession } from './sessionStore';

afterEach(() => {
  useSession.setState({ place: null, workspacePath: null, leftWorkspacePath: null });
  useNavigation.setState({ view: 'changes', pages: [] });
});

describe('exploring a repository without a workspace', () => {
  it('explores it here, on the Branch Explorer, when no window explores it yet', async () => {
    fakeApi.answer('windows.focusPlace', async () => false);

    await exploreHere('game@local');

    expect(fakeApi.argsOf('windows.focusPlace')).toEqual([[repositoryPlace('game@local')]]);
    expect(useSession.getState()).toMatchObject({ place: repositoryPlace('game@local'), workspacePath: null });
    expect(useNavigation.getState().view).toBe('branchExplorer');
  });

  it('brings forward the window already exploring it instead, leaving this one as it is', async () => {
    fakeApi.answer('windows.focusPlace', async () => true);

    await exploreHere('game@local');

    expect(useSession.getState().place).toBeNull();
  });

  it('keeps the view when this window explores it already', async () => {
    fakeApi.answer('windows.focusPlace', async () => false);
    useSession.getState().explore('game@local');
    useNavigation.setState({ view: 'labels' });

    await exploreHere('game@local');

    expect(useNavigation.getState().view).toBe('labels');
  });

  it('explores it in a new window when asked, this one staying where it is', () => {
    fakeApi.answer('windows.openPlace', async () => undefined);

    exploreRepository('game@local', 'newWindow');

    expect(fakeApi.calls()).toEqual([{ method: 'windows.openPlace', args: [repositoryPlace('game@local')] }]);
    expect(useSession.getState().place).toBeNull();
  });
});
