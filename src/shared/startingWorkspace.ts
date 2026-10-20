import type { PageWindowPage } from './domain/pageWindow';

/**
 * A window opened for a workspace (`WorkspaceWindows.open`) names it in its page's address, so the page opens it before
 * its first render (`openWorkspaceFromAddress`) and never draws the home screen on the way. Asking the main process
 * instead (`system.takeRequestedWorkspace`) would put a round trip before the first render, and that waits behind the
 * window's `show()` once an empty first frame made it ready to show. A window reopened after restarting to install an
 * update names the view it showed too, which it opens on instead of Changes.
 */
const WORKSPACE_PARAMETER = 'workspace';
const VIEW_PARAMETER = 'view';
const PAGE_PARAMETER = 'page';

/** The page address's query for a window opened for `workspacePath` (none for the home screen), on `view` if given. */
export function startingWorkspaceQuery(workspacePath: string | undefined, view?: string): Record<string, string> {
  if (!workspacePath) return {};
  return view ? { [WORKSPACE_PARAMETER]: workspacePath, [VIEW_PARAMETER]: view } : { [WORKSPACE_PARAMETER]: workspacePath };
}

/** The workspace a page address's query (`location.search`) names, or null. */
export function startingWorkspaceIn(search: string): string | null {
  return new URLSearchParams(search).get(WORKSPACE_PARAMETER);
}

/** The view a page address's query names (a renderer `ViewId`, unchecked), or null. */
export function startingViewIn(search: string): string | null {
  return new URLSearchParams(search).get(VIEW_PARAMETER);
}

/**
 * The page address's query for a page window (`windows.openPage`): its workspace and the page it shows, which the
 * address keeps, unlike a workspace window's, so a reload shows the page again.
 */
export function pageWindowQuery(workspacePath: string, page: PageWindowPage): Record<string, string> {
  return { [WORKSPACE_PARAMETER]: workspacePath, [PAGE_PARAMETER]: JSON.stringify(page) };
}

/** The page a page window's address names (unchecked: the renderer's `asMovablePage` checks it), or null for any other window. */
export function startingPageIn(search: string): PageWindowPage | null {
  const page = new URLSearchParams(search).get(PAGE_PARAMETER);
  if (page === null) return null;
  try {
    const parsed: unknown = JSON.parse(page);
    return isPageLike(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPageLike(value: unknown): value is PageWindowPage {
  return typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string';
}
