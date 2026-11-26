import type { CmRuntimeStatus } from './domain/cmRuntime';
import type { FoundPath, FoundPathsSource } from './domain/explorer';
import type { UpdateStatus } from './domain/appUpdate';
import type { OperationProgress } from './domain/operation';
import type { PageSeed, PageWindowPage } from './domain/pageWindow';
import type { IssueTrackerSetup } from './domain/issueTrackers';
import type { AppSettings } from './domain/settings';
import type { ServerSession } from './domain/signIn';
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
  /**
   * Refused before it ran: its server needs a sign-in (`SignInGate`), as its output says. Not a failure to point at: the
   * window shows the sign-in screen instead.
   */
  notRun?: true;
  /** Output is kept only for failed commands, to help diagnose them. It and the command line are clipped (`clipForLog`). */
  output: string;
  /**
   * A request to an issue tracker, logged beside `cm`'s commands (docs/features/issue-trackers.md): its line is its
   * method, host and path, its `exitCode` 0 or 1, and its answer's status `httpStatus` (none when none came).
   */
  source?: 'tracker';
  httpStatus?: number;
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
  /** A workspace changed kind (choosing what to download made a standard one partial): every window reads its kind again. */
  workspaceKindChanged: { workspacePath: string };
  operationProgress: OperationProgressEvent;
  /** The best paths a repository's search (`explorer.findRepositoryPaths`) found so far, as they change. */
  repositoryPathsFound: { searchId: string; paths: FoundPath[]; source: FoundPathsSource };
  /** A tracker was signed in to or out of, a credential stopped working, or a repository's tracker changed. */
  issueTrackersChanged: IssueTrackerSetup;
  /** A server came to need a sign-in, or was signed in again: every server that needs one now (`ServerSessions`). */
  serverSessionsChanged: ServerSession[];
  /** The settings changed, in this window or another one. */
  settingsChanged: AppSettings;
  /**
   * The window is asked to open a place, which `system.takeRequestedPlace` tells: a workspace picked from the OS recent
   * documents, or a repository it reopened on at launch, under the name a rename made elsewhere gave it.
   */
  workspaceOpenRequested: Record<string, never>;
  /** A native menu item was chosen; runs the registered command with this id. */
  menuCommand: { commandId: string };
  /** An incoming-changes notification was clicked; the window is already focused. */
  incomingNotificationClicked: { workspacePath: string };
  /** Closing the window, quitting or reloading waits for unsaved edits: settle them, then `windows.continueLeaving`. */
  leaveRequested: Record<string, never>;
  /** The app's `cm` moved on: its setup progressed, failed or finished, or another one runs (`cmRuntime.status`). */
  cmRuntimeChanged: CmRuntimeStatus;
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
