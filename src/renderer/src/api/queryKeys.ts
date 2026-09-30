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
  accounts: ['accounts'] as const,
  mergeTools: ['mergeTools'] as const,
  cmVersion: ['cmVersion'] as const,
  appInfo: ['appInfo'] as const,
  cmSetup: ['cmSetup'] as const,
  homeDirectory: ['homeDirectory'] as const,
  workspaceHeads: (paths: readonly string[]) => ['workspaceHeads', paths] as const,
  workspaceRepositories: (paths: readonly string[]) => ['workspaceRepositories', paths] as const,
  missingWorkspacePaths: (paths: readonly string[]) => ['missingWorkspacePaths', paths] as const,
  inWorkspace: (workspacePath: string, ...parts: unknown[]) => [...workspaceKey(workspacePath), ...parts] as const,
};
