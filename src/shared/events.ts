import type { UpdateStatus } from './domain/appUpdate';
import type { OperationProgress } from './domain/operation';
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
  /** The settings changed, in this window or another one. */
  settingsChanged: AppSettings;
  /** A workspace was picked from the OS recent documents; `system.takeRequestedWorkspace` tells which. */
  workspaceOpenRequested: Record<string, never>;
  /** A native menu item was chosen; runs the registered command with this id. */
  menuCommand: { commandId: string };
  /** An incoming-changes notification was clicked; the window is already focused. */
  incomingNotificationClicked: { workspacePath: string };
  /** Closing the window, quitting or reloading waits for unsaved edits: settle them, then `windows.continueLeaving`. */
  leaveRequested: Record<string, never>;
  /** The app's update moved on (`updates.status`); every window gets it. */
  updateStatusChanged: UpdateStatus;
  /** Windows' Back command: a mouse's back button or a keyboard's Browser Back key. */
  navigateBack: Record<string, never>;
  /** The main process caught an error nothing else did, and kept running; every window gets it. */
  unexpectedError: UnexpectedError;
}

export type UvcsEventName = keyof UvcsEvents;
