import { DEFAULT_PENDING_CHANGES_FILTER, type PendingChangesFilter } from './pendingChanges';

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
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  recentWorkspacePaths: [],
  pendingChanges: DEFAULT_PENDING_CHANGES_FILTER,
  warnOnEmptyComment: true,
  recentComments: [],
  autoRefresh: true,
};
