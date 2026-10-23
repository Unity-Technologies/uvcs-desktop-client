import type { FoundPath, FoundPathsSource } from './domain/explorer';
import type { UpdateStatus } from './domain/appUpdate';
import type { OperationProgress } from './domain/operation';
import type { PageSeed, PageWindowPage } from './domain/pageWindow';
import type { AppSettings } from './domain/settings';
import type { KeptAsideFile } from './domain/switchWithChanges';
import type { WorkspaceChange } from './domain/workspaceChange';

export interface CommandLogEntry {
  id: number;
  commandLine: string;
  cwd: string;
  startedAt: number;
  durationMs: number;
  exitCode: number;
  viaShell: boolean;
  /** It ran in the app's folder outside every workspace: for a repository explored without one (`CmRunOptions.outsideWorkspaces`). */
  outsideWorkspaces?: true;
  /** Output is kept only for failed commands, to help diagnose them. It and the command line are clipped (`clipForLog`). */
  output: string;
}

/** An error the main process didn't expect, which nothing caught (`handleUnexpectedErrors`); its secrets hidden. */
export interface UnexpectedError {
  /** The error's own words, e.g. "Invalid string length". */
  message: string;
  /** The error with its stack, for a bug report; never shown on screen. */
  details: string;
}

interface OperationProgressEvent {
  operationId: string;
  progress: OperationProgress;
}

/**
 * Events pushed from the main process to the renderer. Each window gets the commands and progress of its own
 * API calls, and the changes of the workspace it shows.
 */
export interface UvcsEvents {
  commandLogged: CommandLogEntry;
  workspaceChanged: WorkspaceChange & { workspacePath: string };
  /** Shelved changes came back, but some files moved aside couldn't: another item is at their path now. */
  filesKeptAside: { workspacePath: string; files: KeptAsideFile[] };
  /** The workspace's watch broke once started: changes made outside the app no longer show by themselves. */
  workspaceWatchBroken: { workspacePath: string };
  operationProgress: OperationProgressEvent;
  /** The best paths a repository's search (`explorer.findRepositoryPaths`) found so far, as they change. */
  repositoryPathsFound: { searchId: string; paths: FoundPath[]; source: FoundPathsSource };
  /** The settings changed, in this window or another one. */
  settingsChanged: AppSettings;
  /** A workspace was picked from the OS recent documents; `system.takeRequestedPlace` tells which. */
  workspaceOpenRequested: Record<string, never>;
  /** A native menu item was chosen; runs the registered command with this id. */
  menuCommand: { commandId: string };
  /** An incoming-changes notification was clicked; the window is already focused. */
  incomingNotificationClicked: { workspacePath: string };
  /** Closing the window, quitting or reloading waits for unsaved edits: settle them, then `windows.continueLeaving`. */
  leaveRequested: Record<string, never>;
  /** The app's update moved on (`updates.status`); every window gets it. */
  updateStatusChanged: UpdateStatus;
  /**
   * The page's zoom factor (View > Zoom In, Zoom Out; 1 at 100%), as the page loads and whenever it changes: the page
   * leaves the window's controls the same room in window points (`--window-zoom`).
   */
  pageZoomChanged: { zoom: number };
  /** Windows' Back command: a mouse's back button or a keyboard's Browser Back key. */
  navigateBack: Record<string, never>;
  /** The main process caught an error nothing else did, and kept running; every window gets it. */
  unexpectedError: UnexpectedError;
  /** This page window follows its workspace window's selection now, or stopped (another of its page windows took it). */
  followingChanged: { following: boolean };
  /** A page window follows this workspace window's selection (`windows.selectionShown`), or none does anymore. */
  selectionFollowed: { followed: boolean };
  /** What is selected in the workspace window, for the page window following it to show. */
  selectionToFollow: { page: PageWindowPage; seed?: PageSeed };
  /** This window was handed a `uvcs://` link to open; `windows.takeLink` tells which. */
  linkRequested: Record<string, never>;
  /** One of this workspace window's page windows asks it to open a page only it shows (a merge). */
  pageRequested: { page: PageWindowPage };
}

export type UvcsEventName = keyof UvcsEvents;
