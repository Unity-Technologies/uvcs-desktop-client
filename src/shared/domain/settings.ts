import { AUTO_APP, type CustomEditor } from './externalApps';
import { AUTO_MERGE_TOOL, DEFAULT_MERGE_TOOL_RULES, SAME_AS_OTHER_FILES, type CustomMergeTool, type MergeToolRule } from './mergeTools';
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

/** A window open when the app last quit, opened again where it was at the next launch (`WorkspaceWindows.saveSession`). */
export interface SavedWindow {
  /** The workspace it showed; none on the home screen. */
  workspacePath?: string;
  bounds: SavedWindowBounds;
  fullScreen: boolean;
  /** The view it showed (a renderer `ViewId`): saved only by a restart to install an update, which nobody chose. */
  view?: string;
}

export interface AppSettings {
  theme: ThemePreference;
  recentWorkspacePaths: string[];
  /** The GUIDs of the branches each workspace switched to lately, newest first (never /main), by workspace GUID. */
  recentBranchesByWorkspace: Record<string, string[]>;
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
  /**
   * Show people's Gravatar pictures (their hashed email goes to gravatar.com); initials otherwise. Off until the user
   * chooses it (`gravatarChoiceAsked`, `showsGravatar`).
   */
  showGravatar: boolean;
  /** The user chose whether to show Gravatar pictures, in the one-time prompt or in Settings: it never asks again. */
  gravatarChoiceAsked: boolean;
  /** Show an OS notification when someone checks in to the loaded branch while the window is in the background. */
  notifyOnIncoming: boolean;
  /** The merge tool files no rule matches open in: `auto` (the UVCS merge tool, else the first found) or a tool id. */
  mergeTool: string;
  /** Which tool opens which files, tried in order before `mergeTool` (Settings › Merge). */
  mergeToolRules: MergeToolRule[];
  /** Where Unity assets open when Smart Merge can't merge them: `others` (as any other file) or a tool id. */
  unityMergeTool: string;
  /** Merge apps the user added ("Choose another app…"). */
  customMergeTools: CustomMergeTool[];
  /** The user's arguments for a merge tool, by its id, instead of its own. */
  mergeToolArgs: Record<string, string[]>;
  /**
   * Resolving files one by one, a file closed in the merge tool without saving pauses the run to ask whether to go on;
   * off, the next file opens at once.
   */
  askWhenMergeToolClosesUnsaved: boolean;
  /** The app files and folders open in: `auto` (the first editor found), `system` (each file's default app) or an app id. */
  editor: string;
  /** The terminal "Open in…" opens folders in: `auto` (the platform's usual one) or a terminal id. */
  terminal: string;
  /** Apps the user added to open files in ("Other app…"). */
  customEditors: CustomEditor[];
  /** Null until the window is first moved or resized. */
  windowBounds: SavedWindowBounds | null;
  /** Where the last page window (a diff in a window of its own) was left; null until one is moved or resized. */
  pageWindowBounds: SavedWindowBounds | null;
  /** The windows open when the app last quit, the focused one last; none when it quit with no window open. */
  openWindows: SavedWindow[];
  /**
   * The official Desktop client's settings were imported (`importLegacySettings`), or there were none to import: they
   * are never read again.
   */
  legacySettingsImported: boolean;
  /**
   * The official client's merge tools (client.conf's `<MergeTools>`) became the rules above (`importLegacyMergeTools`),
   * or there were none: they are never read again. Apart from `legacySettingsImported`, which came first.
   */
  mergeToolRulesImported: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  recentWorkspacePaths: [],
  recentBranchesByWorkspace: {},
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
  showGravatar: false,
  gravatarChoiceAsked: false,
  notifyOnIncoming: false,
  mergeTool: AUTO_MERGE_TOOL,
  customMergeTools: [],
  mergeToolArgs: {},
  mergeToolRules: DEFAULT_MERGE_TOOL_RULES,
  unityMergeTool: SAME_AS_OTHER_FILES,
  askWhenMergeToolClosesUnsaved: true,
  editor: AUTO_APP,
  terminal: AUTO_APP,
  customEditors: [],
  windowBounds: null,
  pageWindowBounds: null,
  openWindows: [],
  legacySettingsImported: false,
  mergeToolRulesImported: false,
};
