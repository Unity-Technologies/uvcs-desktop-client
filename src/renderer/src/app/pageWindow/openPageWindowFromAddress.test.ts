import '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { pageWindowQuery, startingWorkspaceQuery } from '@shared/startingWorkspace';
import { useNavigation } from '../navigation/navigationStore';
import type { Page } from '../navigation/pages';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { folderMissingQuery } from '../workspace/useWorkspace';
import { openPageWindowFromAddress } from './openPageWindowFromAddress';
import { usePageWindow } from './pageWindowStore';

afterEach(() => {
  useSession.setState({ workspacePath: null });
  useNavigation.setState({ view: 'changes', pages: [] });
  usePageWindow.setState({ isPageWindow: false });
  queryClient.clear();
});

const addressOf = (query: Record<string, string>) => ({ location: { search: `?${new URLSearchParams(query)}` } });

describe('openPageWindowFromAddress', () => {
  it('starts a page window on its page, in its workspace, without checking its folder again', () => {
    const page: Page = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } };

    expect(openPageWindowFromAddress(addressOf(pageWindowQuery('/work/game', page)))).toBe(true);

    expect(useSession.getState().workspacePath).toBe('/work/game');
    expect(useNavigation.getState().pages).toEqual([page]);
    expect(usePageWindow.getState().isPageWindow).toBe(true);
    expect(queryClient.getQueryData(folderMissingQuery('/work/game').queryKey)).toBe(false);
  });

  it("leaves a workspace window to start as before, and a page that can't show in a window of its own", () => {
    expect(openPageWindowFromAddress(addressOf(startingWorkspaceQuery('/work/game')))).toBe(false);
    expect(openPageWindowFromAddress(addressOf(pageWindowQuery('/work/game', { kind: 'merge', request: {} })))).toBe(false);

    expect(useSession.getState().workspacePath).toBeNull();
    expect(usePageWindow.getState().isPageWindow).toBe(false);
  });
});
