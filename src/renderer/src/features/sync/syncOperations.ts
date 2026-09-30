import type { GitSyncRequest, ReplicationRequest, ReplicationSummary } from '@shared/domain/replication';
import { api } from '../../api/client';
import { runOperation } from '../../app/operations/runOperation';
import { replicationMessage } from './replicationMessage';

/**
 * Sends `branch` from the workspace repository (`request.from`) to `request.to`. Only that other repository changes:
 * nothing this workspace shows is refreshed.
 */
export function pushBranch(workspacePath: string, request: ReplicationRequest): Promise<ReplicationSummary | undefined> {
  return runOperation({
    title: `Pushing ${request.branch} to ${request.to}`,
    workspacePath,
    run: (operationId) => api.sync.push(workspacePath, request, operationId),
    affects: () => false,
    success: (summary) => ({ title: replicationMessage('push', request, summary) }),
  });
}

/** Brings `branch` of `request.from` into the workspace repository (`request.to`). */
export function pullBranch(workspacePath: string, request: ReplicationRequest): Promise<ReplicationSummary | undefined> {
  return runOperation({
    title: `Pulling ${request.branch} from ${request.from}`,
    workspacePath,
    run: (operationId) => api.sync.pull(workspacePath, request, operationId),
    success: (summary) => ({ title: replicationMessage('pull', request, summary) }),
  });
}

export function syncWithGit(workspacePath: string, request: GitSyncRequest): Promise<void | undefined> {
  return runOperation({
    title: `Syncing with ${request.url}`,
    workspacePath,
    run: (operationId) => api.sync.syncWithGit(workspacePath, request, operationId),
    success: () => ({ title: `${request.repository} is in sync with ${request.url}` }),
  });
}
