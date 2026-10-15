// The workspace's own copies of revisions: a revision's bytes read from the workspace's disk instead of downloaded
// with `cm cat`, where the file there has that revision's content (ARCHITECTURE.md "Server budget", "Revisions on
// disk"). Content decides, never status: a file changed, being written, checked out with edits or holding another
// revision has another size or MD5, and is downloaded; one whose bytes are the revision's is that revision, whatever
// `cm status` says of it.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { RevisionRef } from '@shared/domain/revision';
import type { ListedTreeItem } from '../cm/treeItemsXml';
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
/** The listed revisions remembered, the latest listed kept: a few big folders' worth. */
const MAX_LISTED_REVISIONS = 50_000;

interface WorkspaceCopiesOptions {
  /** The most listed revisions remembered; tests pass a few. */
  maxListed?: number;
}

export class WorkspaceCopies {
  private readonly maxListed: number;
  /**
   * The hashes of disk files, by path, size and time written: a file known to differ from a revision isn't read again
   * for it until it changes. A match is always hashed again, on the bytes returned.
   */
  private readonly diskHashes = new Map<string, string>();
  /** The revisions listings named, by workspace and revision, the latest listed last. */
  private readonly listed = new Map<string, RevisionFile>();

  constructor({ maxListed = MAX_LISTED_REVISIONS }: WorkspaceCopiesOptions = {}) {
    this.maxListed = maxListed;
  }

  /**
   * Remembers the revisions a listing named in the workspace (the Files view's folders, Browse repository's, a
   * point's tree beside a model): where its disk may hold each later, and the size and hash that tell. A revision's
   * content never changes, so what is remembered never goes stale; the disk is checked at each read.
   */
  remember(workspacePath: string, files: Iterable<RevisionFile>): void {
    for (const file of files) {
      if (file.hash === null || file.revision.revisionId <= 0) continue;
      const key = listedKey(workspacePath, file.revision);
      this.listed.delete(key);
      this.listed.set(key, file);
    }
    for (const oldest of this.listed.keys()) {
      if (this.listed.size <= this.maxListed) break;
      this.listed.delete(oldest);
    }
  }

  /**
   * The revision's bytes from the workspace's disk, where a listing of this workspace named it (`remember`) and the
   * file at its path there has its content; else null, and it is downloaded.
   */
  async readRevision(workspacePath: string, revision: RevisionRef): Promise<Buffer | null> {
    const file = this.listed.get(listedKey(workspacePath, revision));
    return file ? this.read(workspacePath, file) : null;
  }

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
    const read = await readHashed(absolutePath).catch(() => null);
    if (!read) return null;
    if (this.diskHashes.size >= MAX_DISK_HASHES) this.diskHashes.clear();
    this.diskHashes.set(key, read.hash);
    return read.hash === file.hash ? read.bytes : null;
  }
}

/**
 * A file's bytes and their MD5, hashed chunk by chunk as they are read: a 100 MB model never blocks the main process
 * while it is hashed. The bytes hashed are the bytes returned, so a file written meanwhile can't pass for a revision.
 * Null for one that grew past `MAX_MODEL_BYTES` while read.
 */
async function readHashed(absolutePath: string): Promise<{ bytes: Buffer; hash: string } | null> {
  const hash = createHash('md5');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of createReadStream(absolutePath) as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_MODEL_BYTES) return null;
    hash.update(chunk);
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), hash: hash.digest('base64') };
}

/**
 * The files of a `cm ls --xml` listing as the revisions they hold: neither folders nor links, nor a private item or a
 * checkout, which hold none.
 */
export function revisionFilesOf(items: readonly ListedTreeItem[]): RevisionFile[] {
  return items.flatMap(({ itemType, path, revisionId, repository, hash, size }) =>
    (itemType === 'file' || itemType === 'binaryFile') && revisionId > 0 && hash !== undefined ? [{ path, revision: { revisionId, repository }, hash, size }] : [],
  );
}

/** A content's hash as `cm` keeps it: MD5, base64. */
export function contentHashOf(bytes: Buffer): string {
  return createHash('md5').update(bytes).digest('base64');
}

function listedKey(workspacePath: string, revision: RevisionRef): string {
  return `${workspacePath}\0${revision.revisionId}@${revision.repository}`;
}

function diskKey(path: string, size: number, modified: number): string {
  return `${path}\0${size}\0${modified}`;
}
