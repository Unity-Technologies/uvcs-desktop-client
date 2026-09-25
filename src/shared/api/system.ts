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
}
