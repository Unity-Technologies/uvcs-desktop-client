import type { WorkspaceSummary } from '@shared/domain/workspace';
import { useRecentWorkspaceRepositories, useWorkspaceHeads } from '../workspace/workspaceQueries';
import { describedEntry, headsNamingRepository, type WorkspaceEntry } from './recentWorkspaces';

type Undescribed = Pick<WorkspaceEntry, 'workspace' | 'missing'>;

/**
 * Tells each listed workspace's repository and branch where cheaply known, the same on the home screen and in the
 * switcher: the `.plastic` folder says, and `cm` is asked only about recent workspaces whose folder couldn't tell.
 */
export function useDescribeWorkspace(workspaces: WorkspaceSummary[] | undefined): (entry: Undescribed) => WorkspaceEntry {
  const { data: heads, isFetched: headsRead } = useWorkspaceHeads(workspaces);
  const { data: repositories } = useRecentWorkspaceRepositories(headsRead ? workspaces : undefined, headsNamingRepository(heads));
  return (entry) => describedEntry(entry, heads?.[entry.workspace.path], repositories ?? {});
}
