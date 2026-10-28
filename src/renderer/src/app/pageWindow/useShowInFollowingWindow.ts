import { useEffect } from 'react';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import type { Page } from '../navigation/pages';
import { navigation } from '../navigation/navigationStore';
import { usePlace } from '../workspace/useWorkspace';
import { pageKey } from './followSelection';
import { asPage } from './movablePages';
import { pageSeed } from './pageSeeds';
import { usePageWindow } from './pageWindowStore';

/**
 * What a view's selection shows, as the page of its changes: while a page window follows this window's selection
 * ("Follow selection"), it shows that page once the selection settles there. Called by the view, not its details
 * panel, so it follows while the details are hidden too. Nothing crosses to the main process while no page window
 * follows, or nothing is selected.
 */
export function useShowInFollowingWindow(page: Page | null): void {
  const followed = usePageWindow((state) => state.followed);
  const place = usePlace();
  const key = page && pageKey(page);
  useEffect(() => {
    if (followed && page) void api.windows.selectionShown(page, pageSeed(place, page));
    // Keyed by what the page shows: a view builds its page anew at every render.
  }, [followed, key, place]);
}

/**
 * What a workspace window hears from its page windows: whether one follows its selection (`selectionFollowed`), and
 * the pages only it shows that they ask it to open (a merge: `pageRequested`).
 */
export function useOwnPageWindows(): void {
  useUvcsEvent('selectionFollowed', ({ followed }) => usePageWindow.setState({ followed }));
  useUvcsEvent('pageRequested', ({ page }) => {
    const requested = asPage(page);
    if (requested) navigation.openPage(requested);
  });
}
