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
  /** Windows' Back command: a mouse's back button or a keyboard's Browser Back key. */
  navigateBack: Record<string, never>;
}

export type UvcsEventName = keyof UvcsEvents;
