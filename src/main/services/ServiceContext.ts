import type { BranchNamesCache } from '../cm/BranchNamesCache';
import type { CmClient } from '../cm/CmClient';
import type { OperationTracker } from '../operations/OperationTracker';
import type { DiffReviewStore } from '../review/DiffReviewStore';
import type { ReviewStore } from '../review/ReviewStore';
import type { SettingsStore } from '../settings/SettingsStore';
import type { ExternalAppsCatalog } from '../system/apps/ExternalAppsCatalog';
import type { InstalledAppsCache } from '../system/apps/installedApps';
import type { AppUpdates } from '../update/AppUpdates';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';
import type { LeftChangesFinder } from '../workspace/leftChanges';
import type { WorkspaceHeaders } from '../workspace/WorkspaceHeaders';
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
  headers: WorkspaceHeaders;
  updates: AppUpdates;
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

/**
 * The OS's records of installed apps, read once for the merge tools and the apps files open in, and those apps, shared
 * by the services that open files in them.
 */
export interface AppsContext {
  installedApps: InstalledAppsCache;
  apps: ExternalAppsCatalog;
}
