import type { AnnotateApi } from './annotate';
import type { AttributesApi } from './attributes';
import type { BranchExplorerApi } from './branchExplorer';
import type { BranchesApi } from './branches';
import type { ChangesetsApi } from './changesets';
import type { CodeReviewsApi } from './codeReviews';
import type { ContentApi } from './content';
import type { DiffApi } from './diff';
import type { ExplorerApi } from './explorer';
import type { HistoryApi } from './history';
import type { LabelsApi } from './labels';
import type { LeftChangesApi } from './leftChanges';
import type { LocksApi } from './locks';
import type { MergeApi } from './merge';
import type { PendingChangesApi } from './pendingChanges';
import type { RepositoriesApi } from './repositories';
import type { SettingsApi } from './settings';
import type { ShelvesApi } from './shelves';
import type { SyncApi } from './sync';
import type { SystemApi } from './system';
import type { WorkspacesApi } from './workspaces';

/**
 * Everything the renderer can ask the main process to do.
 * Each area is exposed over IPC as `<area>.<method>`.
 */
export interface UvcsApi {
  annotate: AnnotateApi;
  attributes: AttributesApi;
  branchExplorer: BranchExplorerApi;
  branches: BranchesApi;
  changesets: ChangesetsApi;
  codeReviews: CodeReviewsApi;
  content: ContentApi;
  diff: DiffApi;
  explorer: ExplorerApi;
  history: HistoryApi;
  labels: LabelsApi;
  leftChanges: LeftChangesApi;
  locks: LocksApi;
  merge: MergeApi;
  pendingChanges: PendingChangesApi;
  repositories: RepositoriesApi;
  settings: SettingsApi;
  shelves: ShelvesApi;
  sync: SyncApi;
  system: SystemApi;
  workspaces: WorkspacesApi;
}
