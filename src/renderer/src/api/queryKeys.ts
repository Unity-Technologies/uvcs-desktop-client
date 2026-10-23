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
  /** Every object's permissions on a server: saving some refreshes them all, as objects inherit from each other. */
  permissionsOn: (server: string) => ['permissions', server, 'acl'] as const,
  permissions: (server: string, spec: string) => ['permissions', server, 'acl', spec] as const,
  permissionMembers: (server: string, kind: string, filter: string) => ['permissions', server, 'members', kind, filter] as const,
  profiles: ['profiles'] as const,
  accounts: ['accounts'] as const,
  mergeTools: ['mergeTools'] as const,
  externalApps: ['externalApps'] as const,
  cmVersion: ['cmVersion'] as const,
  appInfo: ['appInfo'] as const,
  releaseNotes: (version: string) => ['releaseNotes', version] as const,
  cmSetup: ['cmSetup'] as const,
  serverConnection: (server: string) => ['serverConnection', server] as const,
  homeDirectory: ['homeDirectory'] as const,
  workspaceHeads: (paths: readonly string[]) => [...queryKeys.everyWorkspaceHeads, paths] as const,
  /** The heads of every list of workspaces read (the home screen's, the switcher's). */
  everyWorkspaceHeads: ['workspaceHeads'] as const,
  workspaceRepository: (path: string) => ['workspaceRepository', path] as const,
  missingWorkspacePaths: (paths: readonly string[]) => ['missingWorkspacePaths', paths] as const,
  inWorkspace: (workspacePath: string, ...parts: unknown[]) => [...workspaceKey(workspacePath), ...parts] as const,
  /**
   * A list of objects (`branches`, `changesets`, `labels`) read with `query`: the workspace's repository's under the
   * key every view of them shares; another repository's (an xlinked one's, `name@server`) in an area of its own,
   * `otherRepository`. What reads the workspace's lists from the cache scans their area (`listedChangeset`,
   * `cachedBranch`) and must never take another repository's ids or GUIDs for its own; and no workspace operation
   * changes another repository, so none refreshes them (the xlink dialog's pickers read them, slow changing).
   */
  objectList: (workspacePath: string, area: string, query: unknown, repository?: string) =>
    repository ? queryKeys.inWorkspace(workspacePath, 'otherRepository', repository, area, query) : queryKeys.inWorkspace(workspacePath, area, query),
};
