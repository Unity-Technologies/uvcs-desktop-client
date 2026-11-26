import { useQuery } from '@tanstack/react-query';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { leftChangesQuery } from './leftChangesQuery';
import { leftChangesSummary } from './leftChangesWords';

/**
 * Changes left on what the workspace is on now, waiting to be restored. Keyed by the selector, so they are looked up
 * again whenever the workspace moves (whoever switched it: the workspace info follows `.plastic`). Never polled:
 * this app's switches and restores refresh it, and shelves left or deleted by other apps show within five minutes.
 */
export function useLeftChanges() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  return useQuery({ ...leftChangesQuery(workspacePath, workspace?.selector), enabled: Boolean(workspace) });
}

/** What waits to be restored, for the dot on Changes in the sidebar; undefined when nothing does. */
export function useLeftChangesSummary(): string | undefined {
  return leftChangesSummary(useLeftChanges().data ?? []);
}
