import '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { pageWindowQuery, startingPlaceQuery } from '@shared/startingPlace';
import { useNavigation } from '../navigation/navigationStore';
import type { Page } from '../navigation/pages';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { cachedShelve } from '../../features/shelves/cachedShelve';
import { folderMissingQuery } from '../workspace/useWorkspace';
import { openPageWindowFromAddress } from './openPageWindowFromAddress';
import { usePageWindow } from './pageWindowStore';

afterEach(() => {
  useSession.setState({ place: null, workspacePath: null });
  useNavigation.setState({ view: 'changes', pages: [] });
  usePageWindow.setState({ isPageWindow: false });
  queryClient.clear();
});

const addressOf = (query: Record<string, string>) => ({ location: { search: `?${new URLSearchParams(query)}` } });

describe('openPageWindowFromAddress', () => {
  it('starts a page window on its page, in its workspace, without checking its folder again', () => {
    const page: Page = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } };

    expect(openPageWindowFromAddress(addressOf(pageWindowQuery(workspacePlace('/work/game'), page)))).toBe(true);

    expect(useSession.getState().workspacePath).toBe('/work/game');
    expect(useNavigation.getState().pages).toEqual([page]);
    expect(usePageWindow.getState().isPageWindow).toBe(true);
    expect(queryClient.getQueryData(folderMissingQuery('/work/game').queryKey)).toBe(false);
  });

  it('starts with the row of what its page shows as its window had read it, without reading it again', () => {
    const shelve = { id: 4, guid: 'g4', comment: 'Wip', owner: 'ana', date: '2026-10-01T10:00:00Z', parentChangeset: 9, repository: 'game@local' };
    const page: Page = { kind: 'diff', title: 'Shelve 4', target: { kind: 'shelve', shelveId: 4 } };

    openPageWindowFromAddress(addressOf(pageWindowQuery(workspacePlace('/work/game'), page, { readAt: 1_700_000_000_000, shelve })));

    expect(cachedShelve(workspacePlace('/work/game'), 4)).toEqual(shelve);
  });

  it("leaves a workspace window to start as before, and a page that can't show in a window of its own", () => {
    expect(openPageWindowFromAddress(addressOf(startingPlaceQuery(workspacePlace('/work/game'))))).toBe(false);
    expect(openPageWindowFromAddress(addressOf(pageWindowQuery(workspacePlace('/work/game'), { kind: 'merge', request: {} })))).toBe(false);

    expect(useSession.getState().workspacePath).toBeNull();
    expect(usePageWindow.getState().isPageWindow).toBe(false);
  });
});
