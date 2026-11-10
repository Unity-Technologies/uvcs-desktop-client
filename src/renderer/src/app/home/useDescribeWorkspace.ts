import type { WorkspaceSummary } from '@shared/domain/workspace';
import { useRecentWorkspaceRepositories, useWorkspaceHeads, useWorkspaceKinds } from '../workspace/workspaceQueries';
import { describedEntry, headsNamingRepository, type WorkspaceEntry } from './recentWorkspaces';

type Undescribed = Pick<WorkspaceEntry, 'workspace' | 'missing'>;

/**
 * Tells each listed workspace's repository, branch and kind where cheaply known, the same on the home screen and in the
 * switcher: a local `cm wi` of each (`useWorkspaceHeads`), and the recent workspaces it couldn't tell are looked up;
 * a local `cm getworkspacefrompath` of each, once a session (`useWorkspaceKinds`).
 */
export function useDescribeWorkspace(workspaces: WorkspaceSummary[] | undefined): (entry: Undescribed) => WorkspaceEntry {
  const { data: heads, isFetched: headsRead } = useWorkspaceHeads(workspaces);
  const { data: kinds } = useWorkspaceKinds(workspaces);
  const { data: repositories } = useRecentWorkspaceRepositories(headsRead ? workspaces : undefined, headsNamingRepository(heads));
  return (entry) => describedEntry(entry, heads?.[entry.workspace.path], repositories ?? {}, kinds?.[entry.workspace.path]);
}
