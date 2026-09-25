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

/** Events pushed from the main process to the renderer. */
export interface UvcsEvents {
  commandLogged: CommandLogEntry;
  workspaceChanged: { workspacePath: string };
  operationProgress: OperationProgress;
}

export type UvcsEventName = keyof UvcsEvents;
