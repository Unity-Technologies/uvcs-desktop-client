import { DEFAULT_PENDING_CHANGES_FILTER, type PendingChangesFilter } from './pendingChanges';
import type { PendingChangesOnSwitch, SwitchShelveRecord } from './switchWithChanges';

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
  /** What to do with pending changes when switching the workspace. */
  pendingChangesOnSwitch: PendingChangesOnSwitch;
  /** Restore the changes left on a branch when switching back to it, if they apply cleanly. */
  restoreLeftChangesAutomatically: boolean;
  /** The shelves created while switching with pending changes, until they are restored or discarded. */
  switchShelves: SwitchShelveRecord[];
  /** The workspaces whose Changes and diffs show review marks, progress and the Unreviewed filter. Off everywhere at first. */
  reviewModeWorkspaces: string[];
  /** The offer to turn on review mode after a burst of changes was dismissed or taken: it never shows again. */
  reviewModeHintDone: boolean;
  /** Show people's Gravatar pictures (their hashed email goes to gravatar.com); initials otherwise. */
  showGravatar: boolean;
  /** Show an OS notification when someone checks in to the loaded branch while the window is in the background. */
  notifyOnIncoming: boolean;
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
  pendingChangesOnSwitch: 'ask',
  restoreLeftChangesAutomatically: true,
  switchShelves: [],
  reviewModeWorkspaces: [],
  reviewModeHintDone: false,
  showGravatar: true,
  notifyOnIncoming: false,
  windowBounds: null,
};
