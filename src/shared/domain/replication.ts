/** How much a push or pull transferred, as reported by `cm`. */
export interface ReplicationSummary {
  changesets: number;
  labels: number;
  items: number;
}

export interface GitSyncRequest {
  repository: string;
  url: string;
  user?: string;
  password?: string;
}

/** Replicate `branch` of repository `from` into repository `to` (both `name@server`). */
export interface ReplicationRequest {
  branch: string;
  from: string;
  to: string;
}
