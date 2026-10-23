import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useSettledValue } from '../../lib/useSettled';
import { afterLeaving } from '../navigation/leaveGuard';
import { useNavigation } from '../navigation/navigationStore';
import type { Page } from '../navigation/pages';
import { pageKey, pagesForFollowed } from './followSelection';
import { useSession } from '../workspace/sessionStore';
import { asMovablePage } from './movablePages';
import { plantPageSeed } from './pageSeeds';
import { usePageWindow } from './pageWindowStore';

/**
 * A page window's "Follow selection": while on, it shows the changes of what is selected in its workspace window,
 * once the selection settles there (arrowing through a list reads only where it stops). Off, it keeps showing what
 * it shows.
 */
export function useFollowSelection(): void {
  const following = usePageWindow((state) => state.following);
  const [selected, setSelected] = useState<Page | null>(null);
  useUvcsEvent('followingChanged', ({ following: now }) => usePageWindow.setState({ following: now }));
  useUvcsEvent('selectionToFollow', ({ page, seed }) => {
    const place = useSession.getState().place;
    if (seed && place) plantPageSeed(place, seed);
    setSelected(asMovablePage(page));
  });
  // A selection from before is no longer what's selected: turned on again, the window waits for its window's.
  useEffect(() => {
    if (!following) setSelected(null);
  }, [following]);
  const settled = useSettledValue(selected, selected ? pageKey(selected) : '');
  const settledKey = settled ? pageKey(settled) : '';

  useEffect(() => {
    if (!following || !settled) return;
    const pages = pagesForFollowed(useNavigation.getState().pages, settled);
    if (pages) afterLeaving(() => useNavigation.setState({ pages }));
    // Keyed by what the selection shows: the same object selected again leaves the page as it is.
  }, [following, settledKey]);
}

/** Turns "Follow selection" on or off; its workspace window starts or stops showing its selection here. */
export function setFollowingSelection(following: boolean): void {
  usePageWindow.setState({ following });
  void api.windows.followSelection(following);
}
