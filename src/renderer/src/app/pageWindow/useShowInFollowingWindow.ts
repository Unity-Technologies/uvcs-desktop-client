import { useEffect } from 'react';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import type { Page } from '../navigation/pages';
import { pageKey } from './followSelection';
import { usePageWindow } from './pageWindowStore';

/**
 * What a details panel shows, as the page of its changes: while a page window follows this window's selection
 * ("Follow selection"), it shows that page once the selection settles there. Nothing crosses to the main process
 * while no page window follows.
 */
export function useShowInFollowingWindow(page: Page): void {
  const followed = usePageWindow((state) => state.followed);
  const key = pageKey(page);
  useEffect(() => {
    if (followed) void api.windows.selectionShown(page);
    // Keyed by what the page shows: a details panel builds its page anew at every render.
  }, [followed, key]);
}

/** Hears whether a page window follows this workspace window's selection (`selectionFollowed`). */
export function useFollowedByPageWindow(): void {
  useUvcsEvent('selectionFollowed', ({ followed }) => usePageWindow.setState({ followed }));
}
