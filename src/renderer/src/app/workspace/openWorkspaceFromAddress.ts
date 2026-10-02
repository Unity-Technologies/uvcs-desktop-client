import { startingViewIn, startingWorkspaceIn } from '@shared/startingWorkspace';
import { useNavigation } from '../navigation/navigationStore';
import { isViewId } from '../navigation/views';
import { queryClient } from '../queryClient';
import { useSession } from './sessionStore';
import { folderMissingQuery } from './useWorkspace';

type Page = { location: Pick<Location, 'search' | 'pathname'>; history: Pick<History, 'replaceState'> };

/**
 * Opens the workspace the window was opened for, named in the page's address (`startingWorkspaceQuery`), before the
 * first render: the window starts on the workspace screen. The main process names it only when its folder is there,
 * so the page doesn't check it again (`folderMissingQuery`) and its first frame is the workspace screen, not an empty
 * one. The address then forgets it, so a reload starts on the home screen as before. The main process's request
 * (`useRequestedWorkspace`) still comes after the first render, finding the workspace already open, and remembers it
 * as recent. A window reopened after restarting to install an update opens on the view it showed, when its address
 * names one this version still has.
 */
export function openWorkspaceFromAddress(page: Page = window): void {
  const workspacePath = startingWorkspaceIn(page.location.search);
  if (!workspacePath) return;
  page.history.replaceState(null, '', page.location.pathname);
  queryClient.setQueryData(folderMissingQuery(workspacePath).queryKey, false);
  useSession.getState().openWorkspace(workspacePath);
  const view = startingViewIn(page.location.search);
  if (view && isViewId(view)) useNavigation.setState({ view });
}
