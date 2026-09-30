/**
 * A window opened for a workspace (`WorkspaceWindows.open`) names it in its page's address, so the page opens it before
 * its first render (`openWorkspaceFromAddress`) and never draws the home screen on the way. Asking the main process
 * instead (`system.takeRequestedWorkspace`) would put a round trip before the first render, and that waits behind the
 * window's `show()` once an empty first frame made it ready to show.
 */
const WORKSPACE_PARAMETER = 'workspace';

/** The page address's query for a window opened for `workspacePath` (none for the home screen). */
export function startingWorkspaceQuery(workspacePath: string | undefined): Record<string, string> {
  return workspacePath ? { [WORKSPACE_PARAMETER]: workspacePath } : {};
}

/** The workspace a page address's query (`location.search`) names, or null. */
export function startingWorkspaceIn(search: string): string | null {
  return new URLSearchParams(search).get(WORKSPACE_PARAMETER);
}
