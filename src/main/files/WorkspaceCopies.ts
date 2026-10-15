// The workspace's own copies of revisions: a revision's bytes read from the workspace's disk instead of downloaded
// with `cm cat`, where the file there has that revision's content (ARCHITECTURE.md "Server budget", "Revisions on
// disk"). Content decides, never status: a file changed, being written, checked out with edits or holding another
// revision has another size or MD5, and is downloaded; one whose bytes are the revision's is that revision, whatever
// `cm status` says of it.

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import type { RevisionRef } from '@shared/domain/revision';
import { MAX_MODEL_BYTES } from './fileContent';
import { workspaceFileOf } from './workspacePaths';

/** A revision of a file, as a listing names it. */
export interface RevisionFile {
  /** Workspace-relative, `/`-separated: the disk's file there is read instead where its content is the revision's. */
  path: string;
  revision: RevisionRef;
  /** MD5, base64, as `cm` keeps it; null where not known (then it's always downloaded). */
  hash: string | null;
  /** -1 where not known. */
  size: number;
}

/** The disk hashes kept, by path, size and time written, before starting over. */
const MAX_DISK_HASHES = 10_000;

export class WorkspaceCopies {
  /** The hashes of disk files, by path, size and time written: a file read once isn't hashed again until it changes. */
  private readonly diskHashes = new Map<string, string>();

  /**
   * The disk's file at the revision's path, when it has the revision's content: the same size, and the same MD5 as
   * the hash listed. Null where it hasn't, isn't there, is past `MAX_MODEL_BYTES`, or the hash isn't known.
   */
  async read(workspacePath: string, file: RevisionFile): Promise<Buffer | null> {
    if (file.hash === null) return null;
    const absolutePath = workspaceFileOf(workspacePath, file.path);
    const stats = await stat(absolutePath).catch(() => null);
    if (!stats?.isFile() || (file.size >= 0 && stats.size !== file.size) || stats.size > MAX_MODEL_BYTES) return null;
    const key = diskKey(absolutePath, stats.size, stats.mtimeMs);
    const known = this.diskHashes.get(key);
    if (known !== undefined && known !== file.hash) return null;
    const bytes = await readFile(absolutePath).catch(() => null);
    if (!bytes) return null;
    // The bytes hashed are the bytes returned: a file written meanwhile can't pass for the revision.
    const hash = contentHashOf(bytes);
    if (this.diskHashes.size >= MAX_DISK_HASHES) this.diskHashes.clear();
    this.diskHashes.set(key, hash);
    return hash === file.hash ? bytes : null;
  }
}

/** A content's hash as `cm` keeps it: MD5, base64. */
export function contentHashOf(bytes: Buffer): string {
  return createHash('md5').update(bytes).digest('base64');
}

function diskKey(path: string, size: number, modified: number): string {
  return `${path}\0${size}\0${modified}`;
}
