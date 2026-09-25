import type { GitSyncRequest, ReplicationRequest, ReplicationSummary } from '@shared/domain/replication';
import { api } from '../../api/client';
import { runOperation } from '../../app/operations/runOperation';

function describeTransfer(summary: ReplicationSummary): string {
  if (summary.changesets === 0) return 'already up to date';
  return `${summary.changesets} ${summary.changesets === 1 ? 'changeset' : 'changesets'}`;
}

/** Sends `branch` from the workspace repository (`request.from`) to `request.to`. */
export function pushBranch(workspacePath: string, request: ReplicationRequest): Promise<ReplicationSummary | undefined> {
  return runOperation({
    title: `Pushing ${request.branch} to ${request.to}`,
    workspacePath,
    run: (operationId) => api.sync.push(workspacePath, request, operationId),
    successMessage: (summary) => `Pushed ${request.branch} to ${request.to}: ${describeTransfer(summary)}`,
  });
}

/** Brings `branch` of `request.from` into the workspace repository (`request.to`). */
export function pullBranch(workspacePath: string, request: ReplicationRequest): Promise<ReplicationSummary | undefined> {
  return runOperation({
    title: `Pulling ${request.branch} from ${request.from}`,
    workspacePath,
    run: (operationId) => api.sync.pull(workspacePath, request, operationId),
    successMessage: (summary) => `Pulled ${request.branch} from ${request.from}: ${describeTransfer(summary)}`,
  });
}

export function syncWithGit(workspacePath: string, request: GitSyncRequest): Promise<void | undefined> {
  return runOperation({
    title: `Syncing with ${request.url}`,
    workspacePath,
    run: (operationId) => api.sync.syncWithGit(workspacePath, request, operationId),
    successMessage: () => `${request.repository} is in sync with ${request.url}`,
  });
}
