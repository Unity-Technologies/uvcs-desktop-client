import type { CmClient } from '../cm/CmClient';
import type { OperationTracker } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';
import type { WorkspaceWatcher } from '../watch/WorkspaceWatcher';

/** Shared dependencies handed to every service. */
export interface ServiceContext {
  cm: CmClient;
  operations: OperationTracker;
  settings: SettingsStore;
  watcher: WorkspaceWatcher;
}
