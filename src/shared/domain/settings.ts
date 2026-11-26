import type { UserColors } from './branchExplorerSettings';
import type { CmChoice } from './cmRuntime';
import { AUTO_APP, type CustomEditor } from './externalApps';
import type { Tool } from './tools';
import { AUTO_MERGE_TOOL, DEFAULT_MERGE_TOOL_RULES, type CustomMergeTool, type MergeToolRule } from './mergeTools';
import { DEFAULT_PENDING_CHANGES_FILTER, type PendingChangesFilter } from './pendingChanges';
import type { RepositorySettings, ServerSettings } from './scopedSettings';
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
  /** The workspace it showed; none on the home screen or a repository explored without one. */
  workspacePath?: string;
  /** The repository it explored without a workspace (`repositoryPlace`). */
  repository?: string;
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
  /**
   * The check-in comments kept before they were per repository, newest first: offered, never written again, to a
   * repository with no list of its own yet (`recentCommentsFor`).
   */
  recentComments: string[];
  /**
   * Recent check-in comments of each repository, newest first, by `repositoryKey`; the repository checked in to last
   * comes first (`withRecentComment`).
   */
  recentCommentsByRepository: Record<string, string[]>;
  /** Automatically refresh pending changes when files change on disk. */
  autoRefresh: boolean;
  /**
   * Which `cm` the app runs: the one installed on the computer when there is one, or its own (`automatic`, the
   * default until the user chooses), the installed one (`installed`), or always its own (`managed`) (Settings ›
   * Workspaces, docs/features/cm-runtime.md "Which cm runs").
   */
  cmChoice: CmChoice;
  /**
   * The pinned version (the oldest `cm` the app runs) for which the user chose the app's own over updating an older
   * installed one ("Use the included version for now"): not asked again until the pin moves. Null when never chosen.
   */
  cmDeclinedUpdateFor: string | null;
  /** Folder new workspaces are created in; empty means the home folder. */
  defaultWorkspaceRoot: string;
  /** What to do with pending changes when switching the workspace. */
  pendingChangesOnSwitch: PendingChangesOnSwitch;
  /** Restore the changes left on a branch when switching back to it, if they apply cleanly. */
  restoreLeftChangesAutomatically: boolean;
  /** The shelves created while switching with pending changes, until they are restored or discarded. */
  switchShelves: SwitchShelveRecord[];
  /**
   * The places whose Changes and diffs show review marks, progress and the Unreviewed filter, by `placeId`: a
   * workspace's path, a repository explored without one as `repository:<spec>`. Off everywhere at first.
   */
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
  /**
   * The Unity account last picked in a home screen's account switcher (its `UserAccount.id`), which a home screen
   * shows unless something on it names another (`homeAccountOf`); empty until one is picked. It changes nothing in `cm`.
   */
  homeAccount: string;
  /**
   * The organizations the home sidebar lists first, under Favorites, by server (`acme@unity`, `acme@cloud`), changed
   * one at a time by the main process (`withFavoriteOrganization`). It changes nothing in `cm`.
   */
  favoriteOrganizations: string[];
  /**
   * What the user built up or chose in each repository (Branch Explorer rules and moved branches, the sync remote), by
   * `repositoryKey`, changed one repository at a time by the main process (`updateRepositorySettings`).
   */
  repositorySettings: Record<string, RepositorySettings>;
  /** What the user chose for each server (the home screen's project), by `serverKey`, changed one at a time (`updateServerSettings`). */
  serverSettings: Record<string, ServerSettings>;
  /** The Branch Explorer's changeset colors by user, the same in every repository; each turns them off in its own settings. */
  changesetColors: UserColors;
  /** The merge tool files no rule matches open in: `auto` (the UVCS merge tool, else the first found) or a tool id. */
  mergeTool: string;
  /** Which tool opens which files, tried in order before `mergeTool` (Settings › Merge). */
  mergeToolRules: MergeToolRule[];
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
  /** Programs the user runs on what they selected, from its menu's "Tools ▸" (Settings › Tools). */
  tools: Tool[];
  /**
   * The zoom of every window (View > Zoom In, Zoom Out: `zoomPage`), as a Chromium zoom level: 0 at 100%, each step of
   * 1 about 20% larger (`1.2 ** level`). Saved by the app, not left to Chromium, which keys a zoom by the page's address.
   */
  zoomLevel: number;
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
   * The official client's merge tools (client.conf's `<MergeTools>`) became the rules above (`importMergeTools`, in
   * `importLegacySettings`), or there were none: they are never read again. Apart from `legacySettingsImported`, which
   * came first.
   */
  legacyMergeToolsImported: boolean;
  /**
   * The official client's external tools (`externaltools.conf`) became `tools`, and its "Open with" programs
   * (`openwith.conf`) `customEditors` (`importTools`, in `importLegacySettings`), or there were none: never read again.
   */
  legacyToolsImported: boolean;
}

/**
 * What a window's own storage kept before the settings held it (the Branch Explorer's rules, moved branches and
 * colors, the sync remotes, the home screen's projects), brought once by each window (`addWindowSettings`).
 */
export type WindowKeptSettings = Pick<AppSettings, 'repositorySettings' | 'serverSettings' | 'changesetColors'>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  recentWorkspacePaths: [],
  recentBranchesByWorkspace: {},
  pendingChanges: DEFAULT_PENDING_CHANGES_FILTER,
  warnOnEmptyComment: true,
  recentComments: [],
  recentCommentsByRepository: {},
  autoRefresh: true,
  cmChoice: 'automatic',
  cmDeclinedUpdateFor: null,
  defaultWorkspaceRoot: '',
  pendingChangesOnSwitch: 'ask',
  restoreLeftChangesAutomatically: true,
  switchShelves: [],
  reviewModeWorkspaces: [],
  reviewModeHintDone: false,
  showGravatar: false,
  gravatarChoiceAsked: false,
  notifyOnIncoming: false,
  homeAccount: '',
  favoriteOrganizations: [],
  repositorySettings: {},
  serverSettings: {},
  changesetColors: { users: [] },
  mergeTool: AUTO_MERGE_TOOL,
  customMergeTools: [],
  mergeToolArgs: {},
  mergeToolRules: DEFAULT_MERGE_TOOL_RULES,
  askWhenMergeToolClosesUnsaved: true,
  editor: AUTO_APP,
  terminal: AUTO_APP,
  customEditors: [],
  tools: [],
  zoomLevel: 0,
  windowBounds: null,
  pageWindowBounds: null,
  openWindows: [],
  legacySettingsImported: false,
  legacyMergeToolsImported: false,
  legacyToolsImported: false,
};
