/**
 * A window opened for a workspace (`WorkspaceWindows.open`) names it in its page's address, so the page opens it before
 * its first render (`openWorkspaceFromAddress`) and never draws the home screen on the way. Asking the main process
 * instead (`system.takeRequestedWorkspace`) would put a round trip before the first render, and that waits behind the
 * window's `show()` once an empty first frame made it ready to show. A window reopened after restarting to install an
 * update names the view it showed too, which it opens on instead of Changes.
 */
const WORKSPACE_PARAMETER = 'workspace';
const VIEW_PARAMETER = 'view';

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
