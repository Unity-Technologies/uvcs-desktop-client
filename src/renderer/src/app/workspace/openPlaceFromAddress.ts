import type { Place } from '@shared/domain/place';
import { startingPlaceIn, startingViewIn } from '@shared/startingPlace';
import { useNavigation } from '../navigation/navigationStore';
import { firstViewOf, isViewId, showsView } from '../navigation/views';
import { queryClient } from '../queryClient';
import { useSession } from './sessionStore';
import { folderMissingQuery } from './useWorkspace';

type Page = { location: Pick<Location, 'search' | 'pathname'>; history: Pick<History, 'replaceState'> };

/**
 * Opens the place the window was opened for, named in the page's address (`startingPlaceQuery`), before the first
 * render: the window starts on the place's screen. The address then forgets it, so a reload starts on the home screen
 * as before. The main process's request (`useRequestedPlace`) still comes after the first render, finding the place
 * already open, and remembers a workspace as recent. A window reopened after restarting to install an update opens on
 * the view it showed, when its address names one this version still has and the place shows; else on the place's
 * first view (`firstViewOf`).
 */
export function openPlaceFromAddress(page: Page = window): void {
  const place = startingPlaceIn(page.location.search);
  if (!place) return;
  const view = startingViewIn(page.location.search);
  page.history.replaceState(null, '', page.location.pathname);
  showStartingPlace(place);
  useNavigation.setState({ view: view && isViewId(view) && showsView(place, view) ? view : firstViewOf(place) });
}

/**
 * Shows a place the main process named in a window's address (a window, or a page window). It names a workspace only
 * when its folder is there, so the page doesn't check it again (`folderMissingQuery`) and its first frame is the
 * workspace screen, not an empty one.
 */
export function showStartingPlace(place: Place): void {
  if (place.kind === 'repository') {
    useSession.getState().explore(place.repository);
    return;
  }
  queryClient.setQueryData(folderMissingQuery(place.workspacePath).queryKey, false);
  useSession.getState().openWorkspace(place.workspacePath);
}
