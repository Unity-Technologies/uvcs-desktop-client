import type { AppSettings } from './domain/settings';

export interface CommandLogEntry {
  id: number;
  commandLine: string;
  cwd: string;
  startedAt: number;
  durationMs: number;
  exitCode: number;
  viaShell: boolean;
  /** Output is kept only for failed commands, to help diagnose them. */
  output: string;
}

export interface OperationProgress {
  operationId: string;
  line: string;
}

/** What changed on disk in a workspace since the last event. */
export interface WorkspaceChange {
  /** Workspace files changed: the pending changes may differ. */
  content: boolean;
  /** Items were added, deleted or moved, not only edited. */
  pathsChanged: boolean;
  /** `cm` rewrote the workspace state in `.plastic` (checkin, update, switch, undo...), whoever ran it. */
  metadata: boolean;
}

/**
 * Events pushed from the main process to the renderer. Each window gets the commands and progress of its own
 * API calls, and the changes of the workspace it shows.
 */
export interface UvcsEvents {
  commandLogged: CommandLogEntry;
  workspaceChanged: WorkspaceChange & { workspacePath: string };
  operationProgress: OperationProgress;
  /** The settings changed, in this window or another one. */
  settingsChanged: AppSettings;
  /** A workspace was picked from the OS recent documents; `system.takeRequestedWorkspace` tells which. */
  workspaceOpenRequested: Record<string, never>;
  /** A native menu item was chosen; runs the registered command with this id. */
  menuCommand: { commandId: string };
  /** An incoming-changes notification was clicked; the window is already focused. */
  incomingNotificationClicked: { workspacePath: string };
}

export type UvcsEventName = keyof UvcsEvents;
