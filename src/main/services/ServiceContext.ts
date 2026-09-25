import type { BranchNamesCache } from '../cm/BranchNamesCache';
import type { CmClient } from '../cm/CmClient';
import type { OperationTracker } from '../operations/OperationTracker';
import type { DiffReviewStore } from '../review/DiffReviewStore';
import type { ReviewStore } from '../review/ReviewStore';
import type { SettingsStore } from '../settings/SettingsStore';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';
import type { LeftChangesFinder } from '../workspace/leftChanges';
import type { SwitchShelveRecords } from '../workspace/switchShelveRecords';

/** Shared dependencies handed to every service. */
export interface ServiceContext {
  cm: CmClient;
  operations: OperationTracker;
  reviews: ReviewStore;
  diffReviews: DiffReviewStore;
  settings: SettingsStore;
  watchers: WorkspaceWatchers;
  windows: WorkspaceWindows;
}

/**
 * Branch names by object id (code reviews name their branches by id), shared by the services that read branches
 * so a list already read answers the lookups.
 */
export interface BranchNamesContext {
  branchNames: BranchNamesCache;
}

/** What switching with pending changes shares across services: its shelve records and the left-changes lookup. */
export interface SwitchContext {
  switchShelves: SwitchShelveRecords;
  leftChanges: LeftChangesFinder;
}
