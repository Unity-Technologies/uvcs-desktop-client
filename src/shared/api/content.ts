import type { ContentSource, FileContent } from '../domain/content';

export interface ContentApi {
  read(workspacePath: string, source: ContentSource): Promise<FileContent>;
  /**
   * A file's bytes, whatever they are: what a model needs beside it (a glTF's `.bin`), which reads as an opaque binary.
   * Null for an empty side, or past a model's size cap.
   */
  readBytes(workspacePath: string, source: ContentSource): Promise<Uint8Array | null>;
  /** Overwrites a workspace file with the given text, e.g. after resolving a conflict. */
  writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void>;
}
