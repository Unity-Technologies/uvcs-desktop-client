import type { AccountsApi } from './accounts';
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
import type { MergeToolsApi } from './mergeTools';
import type { PendingChangesApi } from './pendingChanges';
import type { PermissionsApi } from './permissions';
import type { RepositoriesApi } from './repositories';
import type { ReviewApi } from './review';
import type { SettingsApi } from './settings';
import type { ShelvesApi } from './shelves';
import type { SyncApi } from './sync';
import type { SystemApi } from './system';
import type { UpdatesApi } from './updates';
import type { WindowsApi } from './windows';
import type { WorkspacesApi } from './workspaces';

/**
 * Everything the renderer can ask the main process to do.
 * Each area is exposed over IPC as `<area>.<method>`.
 */
export interface UvcsApi {
  accounts: AccountsApi;
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
  mergeTools: MergeToolsApi;
  pendingChanges: PendingChangesApi;
  permissions: PermissionsApi;
  repositories: RepositoriesApi;
  review: ReviewApi;
  settings: SettingsApi;
  shelves: ShelvesApi;
  sync: SyncApi;
  system: SystemApi;
  updates: UpdatesApi;
  windows: WindowsApi;
  workspaces: WorkspacesApi;
}
