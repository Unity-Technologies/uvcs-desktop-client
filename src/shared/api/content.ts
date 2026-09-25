import type { ContentSource, FileContent } from '../domain/content';

export interface ContentApi {
  read(workspacePath: string, source: ContentSource): Promise<FileContent>;
  /** Overwrites a workspace file with the given text, e.g. after resolving a conflict. */
  writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void>;
}
