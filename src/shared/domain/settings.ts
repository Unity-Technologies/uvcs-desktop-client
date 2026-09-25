import { DEFAULT_PENDING_CHANGES_FILTER, type PendingChangesFilter } from './pendingChanges';
import type { PendingChangesOnSwitch, SwitchShelveRecord } from './switchWithChanges';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
  recentWorkspacePaths: string[];
  pendingChanges: PendingChangesFilter;
  /** Ask for confirmation before checking in without a comment. */
  warnOnEmptyComment: boolean;
  /** Recent checkin comments, newest first. */
  recentComments: string[];
  /** Automatically refresh pending changes when files change on disk. */
  autoRefresh: boolean;
  /** Folder new workspaces are created in; empty means the home folder. */
  defaultWorkspaceRoot: string;
  /** What to do with pending changes when switching the workspace. */
  pendingChangesOnSwitch: PendingChangesOnSwitch;
  /** Restore the changes left on a branch when switching back to it, if they apply cleanly. */
  restoreLeftChangesAutomatically: boolean;
  /** The shelves created while switching with pending changes, until they are restored or discarded. */
  switchShelves: SwitchShelveRecord[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  recentWorkspacePaths: [],
  pendingChanges: DEFAULT_PENDING_CHANGES_FILTER,
  warnOnEmptyComment: true,
  recentComments: [],
  autoRefresh: true,
  defaultWorkspaceRoot: '',
  pendingChangesOnSwitch: 'ask',
  restoreLeftChangesAutomatically: true,
  switchShelves: [],
};
