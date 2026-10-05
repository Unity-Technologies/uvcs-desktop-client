import type { SetupProblem } from '../domain/setup';

/** A folder being dragged over a window, read while the drag runs (`system.draggedFolder`). */
export interface DraggedFolder {
  path: string;
  /** The folder is a workspace or inside one: it holds, or a folder above it holds, a `.plastic` folder. */
  isWorkspace: boolean;
}

export interface SystemApi {
  /** Looks for `cm` again (it may have been installed meanwhile) and returns its version. */
  cmVersion(): Promise<string>;
  /** Checks that `cm` is configured, signed in and reaches its default server; null when all is well. */
  checkSetup(): Promise<SetupProblem | null>;
  currentUser(): Promise<string>;
  /** Opens a file with the OS's default app for its type (a folder in the file manager); `apps` opens it in a chosen one. */
  openPath(path: string): Promise<void>;
  revealInFileManager(path: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  /** Moves files to the OS trash, so deleting private files can be undone. */
  moveToTrash(paths: string[]): Promise<void>;
  /**
   * The folder dragged over the window right now, so the drop overlay can say whether it opens or creates a workspace.
   * Only macOS tells (its drag pasteboard); null on Windows and Linux, for a file, and when the drag can't be read. A
   * guess for the overlay's words only: a drop decides on the dropped path. No `cm` call.
   */
  draggedFolder(): Promise<DraggedFolder | null>;
  pickDirectory(title: string, defaultPath?: string): Promise<string | null>;
  homeDirectory(): Promise<string>;
  cancelOperation(operationId: string): Promise<void>;
  /** Lists the workspace in the OS recent documents (the Dock menu on macOS, the jump list on Windows). */
  addRecentDocument(workspacePath: string): Promise<void>;
  /** The workspace this window was asked to open (picked from the OS recent documents, or opened in a new window), once; null if none. */
  takeRequestedWorkspace(): Promise<string | null>;
  /**
   * A data URL of the user's Gravatar picture, or null when they have none, the user isn't an email address, or profile
   * pictures are turned off (`showGravatar`). Kept for the session, missing pictures included.
   */
  gravatar(user: string, size: number): Promise<string | null>;
  /** Shows an OS notification about incoming changes; clicking it focuses the window and sends `incomingNotificationClicked`. */
  notifyIncoming(workspacePath: string, message: string): Promise<void>;
}
