import { startingWorkspaceIn } from '@shared/startingWorkspace';
import { useSession } from './sessionStore';

type Page = { location: Pick<Location, 'search' | 'pathname'>; history: Pick<History, 'replaceState'> };

/**
 * Opens the workspace the window was opened for, named in the page's address (`startingWorkspaceQuery`), before the
 * first render: the window starts on the workspace screen. The address then forgets it, so a reload starts on the home
 * screen as before. The main process's request (`useRequestedWorkspace`) still comes after the first render, finding
 * the workspace already open, and remembers it as recent.
 */
export function openWorkspaceFromAddress(page: Page = window): void {
  const workspacePath = startingWorkspaceIn(page.location.search);
  if (!workspacePath) return;
  page.history.replaceState(null, '', page.location.pathname);
  useSession.getState().openWorkspace(workspacePath);
}
