import { DEFAULT_PENDING_CHANGES_FILTER, type PendingChangesFilter } from './pendingChanges';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Where the main window was last, to reopen it there. */
export interface SavedWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

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
  /** Null until the window is first moved or resized. */
  windowBounds: SavedWindowBounds | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  recentWorkspacePaths: [],
  pendingChanges: DEFAULT_PENDING_CHANGES_FILTER,
  warnOnEmptyComment: true,
  recentComments: [],
  autoRefresh: true,
  defaultWorkspaceRoot: '',
  windowBounds: null,
};
