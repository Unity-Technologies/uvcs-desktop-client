const MAX_RECENT_WORKSPACES = 10;

/** The recent workspaces with this one first. */
export function withRecentWorkspace(recentPaths: readonly string[], workspacePath: string): string[] {
  return [workspacePath, ...withoutRecentWorkspace(recentPaths, workspacePath)].slice(0, MAX_RECENT_WORKSPACES);
}

export function withoutRecentWorkspace(recentPaths: readonly string[], workspacePath: string): string[] {
  return recentPaths.filter((path) => path !== workspacePath);
}
