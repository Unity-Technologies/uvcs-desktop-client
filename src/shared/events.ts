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

/** Events pushed from the main process to the renderer. */
export interface UvcsEvents {
  commandLogged: CommandLogEntry;
  workspaceChanged: WorkspaceChange & { workspacePath: string };
  operationProgress: OperationProgress;
  /** A native menu item was chosen; runs the registered command with this id. */
  menuCommand: { commandId: string };
}

export type UvcsEventName = keyof UvcsEvents;
