import type { WorkspaceSummary } from '@shared/domain/workspace';
import { useRecentWorkspaceRepositories, useWorkspaceHeads } from '../workspace/workspaceQueries';
import type { WorkspaceEntry } from './recentWorkspaces';

type Undescribed = Pick<WorkspaceEntry, 'workspace' | 'missing'>;

/**
 * Tells each listed workspace's repository and branch where cheaply known, the same on the home screen and in the
 * switcher: the `.plastic` folder says, and `cm` is asked only about recent workspaces whose folder couldn't tell.
 */
export function useDescribeWorkspace(workspaces: WorkspaceSummary[] | undefined): (entry: Undescribed) => WorkspaceEntry {
  const { data: heads, isFetched: headsRead } = useWorkspaceHeads(workspaces);
  const { data: repositories } = useRecentWorkspaceRepositories(headsRead ? workspaces : undefined, heads);
  return ({ workspace, missing }) => {
    const head = heads?.[workspace.path];
    return { workspace, missing, repository: head?.repository ?? repositories?.[workspace.path], selector: head?.selector ?? null };
  };
}
