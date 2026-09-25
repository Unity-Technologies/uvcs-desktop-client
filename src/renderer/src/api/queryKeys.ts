/**
 * Every query about a workspace starts with `workspaceKey(path)`, so a single
 * invalidation refreshes all of its views after an operation changes it.
 */
export function workspaceKey(workspacePath: string): readonly unknown[] {
  return ['workspace', workspacePath];
}

export const queryKeys = {
  workspaces: ['workspaces'] as const,
  settings: ['settings'] as const,
  user: ['user'] as const,
  repositories: (server: string) => ['repositories', server] as const,
  profiles: ['profiles'] as const,
  inWorkspace: (workspacePath: string, ...parts: unknown[]) => [...workspaceKey(workspacePath), ...parts] as const,
};
