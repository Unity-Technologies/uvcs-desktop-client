import type { ContentSource, FileContent } from '../domain/content';
import type { Place } from '../domain/place';

export interface ContentApi {
  /** A workspace's files, what it loaded and its review snapshots are read only in a workspace. */
  read(place: Place, source: ContentSource): Promise<FileContent>;
  /**
   * A file's bytes, whatever they are: what a model needs beside it (a glTF's `.bin`, its `.meta`). Null when it
   * isn't there (or for an empty side), an answer to keep; any other failure rejects, and so does a file past a
   * model's size cap.
   */
  readBytes(place: Place, source: ContentSource): Promise<Uint8Array | null>;
  /** Overwrites a workspace file with the given text, e.g. after resolving a conflict. */
  writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void>;
}
