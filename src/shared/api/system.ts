export interface SystemApi {
  cmVersion(): Promise<string>;
  currentUser(): Promise<string>;
  openPath(path: string): Promise<void>;
  revealInFileManager(path: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  /** Moves files to the OS trash, so deleting private files can be undone. */
  moveToTrash(paths: string[]): Promise<void>;
  pickDirectory(title: string): Promise<string | null>;
  cancelOperation(operationId: string): Promise<void>;
}
