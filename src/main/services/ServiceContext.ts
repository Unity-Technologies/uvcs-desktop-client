import type { CmClient } from '../cm/CmClient';
import type { OperationTracker } from '../operations/OperationTracker';
import type { ReviewStore } from '../review/ReviewStore';
import type { SettingsStore } from '../settings/SettingsStore';
import type { WorkspaceWatcher } from '../watch/WorkspaceWatcher';
import type { LeftChangesFinder } from '../workspace/leftChanges';
import type { SwitchShelveRecords } from '../workspace/switchShelveRecords';

/** Shared dependencies handed to every service. */
export interface ServiceContext {
  cm: CmClient;
  operations: OperationTracker;
  reviews: ReviewStore;
  settings: SettingsStore;
  watcher: WorkspaceWatcher;
}

/** What switching with pending changes shares across services: its shelve records and the left-changes lookup. */
export interface SwitchContext {
  switchShelves: SwitchShelveRecords;
  leftChanges: LeftChangesFinder;
}
