import type { GitSyncRequest, ReplicationRequest, ReplicationSummary } from '../domain/replication';

export interface SyncApi {
  /** Sends a branch from a repository of the workspace's server to another repository. */
  push(workspacePath: string, request: ReplicationRequest, operationId: string): Promise<ReplicationSummary>;
  /** Brings a branch from another repository into a local one. */
  pull(workspacePath: string, request: ReplicationRequest, operationId: string): Promise<ReplicationSummary>;
  /** Pushes and pulls every change between a repository and a Git remote. */
  syncWithGit(workspacePath: string, request: GitSyncRequest, operationId: string): Promise<void>;
}
