import type { WorkspaceHead, WorkspaceSummary } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../queryClient';
import { workspacePreview, type WorkspacePreview } from './workspacePreview';

/**
 * What the home screen already read of the workspace at `path`, from the cache only: it never asks `cm`. The top bar
 * shows it while the workspace's own info loads, so the pills change as little as possible when it arrives.
 */
export function useWorkspacePreview(path: string): WorkspacePreview {
  const workspaces = queryClient.getQueryData<WorkspaceSummary[]>(queryKeys.workspaces);
  const heads = queryClient.getQueriesData<Record<string, WorkspaceHead>>({ queryKey: queryKeys.everyWorkspaceHeads });
  return workspacePreview(path, workspaces, heads.map(([, data]) => data));
}
