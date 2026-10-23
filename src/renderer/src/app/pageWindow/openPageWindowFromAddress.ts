import { startingPageIn, startingPlaceIn, startingSeedIn } from '@shared/startingPlace';
import { useNavigation } from '../navigation/navigationStore';
import { showStartingPlace } from '../workspace/openPlaceFromAddress';
import { asMovablePage } from './movablePages';
import { plantPageSeed } from './pageSeeds';
import { usePageWindow } from './pageWindowStore';

type AddressPage = { location: Pick<Location, 'search'> };

/**
 * Starts a page window (`windows.openPage`) on the page its address names, in its workspace, before the first render,
 * with what its page shows as its window had read it (`plantPageSeed`).
 * Its address keeps them, so a reload shows the page again. False for any other window, which starts as before
 * (`openPlaceFromAddress`). Its window showed the place a moment ago: a workspace's folder is there.
 */
export function openPageWindowFromAddress(page: AddressPage = window): boolean {
  const place = startingPlaceIn(page.location.search);
  const shown = startingPageIn(page.location.search);
  const movable = shown && asMovablePage(shown);
  if (!place || !movable) return false;
  const seed = startingSeedIn(page.location.search);
  if (seed) plantPageSeed(place, seed);
  showStartingPlace(place);
  useNavigation.setState({ pages: [movable] });
  usePageWindow.setState({ isPageWindow: true });
  return true;
}
