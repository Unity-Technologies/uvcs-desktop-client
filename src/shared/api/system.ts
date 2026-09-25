import type { SetupProblem } from '../domain/setup';

export interface SystemApi {
  /** Looks for `cm` again (it may have been installed meanwhile) and returns its version. */
  cmVersion(): Promise<string>;
  /** Checks that `cm` is configured, signed in and reaches its default server; null when all is well. */
  checkSetup(): Promise<SetupProblem | null>;
  currentUser(): Promise<string>;
  openPath(path: string): Promise<void>;
  revealInFileManager(path: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  /** Moves files to the OS trash, so deleting private files can be undone. */
  moveToTrash(paths: string[]): Promise<void>;
  pickDirectory(title: string, defaultPath?: string): Promise<string | null>;
  homeDirectory(): Promise<string>;
  cancelOperation(operationId: string): Promise<void>;
  /** Lists the workspace in the OS recent documents (the Dock menu on macOS, the jump list on Windows). */
  addRecentDocument(workspacePath: string): Promise<void>;
  /** The workspace last picked from the OS recent documents, once; null if none is waiting. */
  takeRequestedWorkspace(): Promise<string | null>;
  /** Shows an OS notification about incoming changes; clicking it focuses the window and sends `incomingNotificationClicked`. */
  notifyIncoming(workspacePath: string, message: string): Promise<void>;
}
