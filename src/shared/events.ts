import type { OperationProgress } from './domain/operation';
import type { AppSettings } from './domain/settings';

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

export interface OperationProgressEvent {
  operationId: string;
  progress: OperationProgress;
}

/** What changed on disk in a workspace since the last event. */
export interface WorkspaceChange {
  /** Workspace files changed: the pending changes may differ. */
  content: boolean;
  /** Items were added, deleted or moved, not only edited. */
  pathsChanged: boolean;
  /** `cm` rewrote the workspace state in `.plastic` (checkin, update, switch, undo...), whoever ran it. */
  metadata: boolean;
  /**
   * The folders whose items changed (workspace-relative, `/`-separated, `''` for the root); null when the platform
   * didn't tell, or too many changed to list them (`MAX_CHANGED_FOLDERS`): anywhere.
   */
  folders: string[] | null;
}

/** Past this many folders, a change counts as anywhere: the listings to re-read would be most of what's open anyway. */
export const MAX_CHANGED_FOLDERS = 100;

/** What two changes in a row changed, as one. */
export function mergeChanges(first: WorkspaceChange, second: WorkspaceChange): WorkspaceChange {
  return {
    content: first.content || second.content,
    pathsChanged: first.pathsChanged || second.pathsChanged,
    metadata: first.metadata || second.metadata,
    folders: mergeFolders(first.folders, second.folders),
  };
}

function mergeFolders(first: string[] | null, second: string[] | null): string[] | null {
  if (first === null || second === null) return null;
  const added = second.filter((folder) => !first.includes(folder));
  if (added.length === 0) return first;
  const merged = [...first, ...new Set(added)];
  return merged.length > MAX_CHANGED_FOLDERS ? null : merged;
}

/**
 * Events pushed from the main process to the renderer. Each window gets the commands and progress of its own
 * API calls, and the changes of the workspace it shows.
 */
export interface UvcsEvents {
  commandLogged: CommandLogEntry;
  workspaceChanged: WorkspaceChange & { workspacePath: string };
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
