export interface SystemApi {
  cmVersion(): Promise<string>;
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
}
