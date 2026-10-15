// The workspace's own copies of revisions (ARCHITECTURE.md "Server budget", "Revisions on disk"): every revision a
// view reads is looked for on the workspace's disk before it is downloaded with `cm cat`. Which file, which revision:
// the revision's path and id. Does the disk have that file, and is it that revision, unchanged? The workspace tells
// which revision it loaded at the path, and its size and hash (`cm ls`, one listing per folder), and the file's bytes
// must have that size and MD5. Then the disk's bytes are read; otherwise the revision is downloaded. Content decides,
// never status: a file changed, being written, checked out (revision -1) or holding another revision is downloaded.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RevisionRef } from '@shared/domain/revision';
import type { CmClient } from '../cm/CmClient';
import type { ListedTreeItem } from '../cm/treeItemsXml';
import { parseWorkspaceListing, workspaceListingArgs } from '../cm/workspaceListing';
import { MAX_MODEL_BYTES } from './fileContent';
import { toAbsolutePath, workspaceFileOf } from './workspacePaths';

/** A revision of a file, as a listing names it, or as a reader asks for it. */
export interface RevisionFile {
  /** Workspace-relative, `/`-separated: where the workspace's disk may hold it. */
  path: string;
  revision: RevisionRef;
  /** MD5, base64, as `cm` keeps it; null where the reader doesn't know it (then the workspace is asked). */
  hash: string | null;
  /** -1 where not known. */
  size: number;
}

/** The disk hashes kept, by path, size and time written, before starting over. */
const MAX_DISK_HASHES = 10_000;
/** The listed revisions remembered, the latest listed kept: a few big folders' worth. */
const MAX_LISTED_REVISIONS = 50_000;
/** The workspace folders whose listing is kept, the latest asked kept. */
const MAX_LISTED_FOLDERS = 500;

interface WorkspaceCopiesOptions {
  /** Lists a workspace folder when a read's revision isn't known yet; without it, only what was remembered tells. */
  cm?: Pick<CmClient, 'query'>;
  /** The most listed revisions remembered; tests pass a few. */
  maxListed?: number;
}

export class WorkspaceCopies {
  private readonly cm: Pick<CmClient, 'query'> | undefined;
  private readonly maxListed: number;
  /**
   * The hashes of disk files, by path, size and time written: a file known to differ from a revision isn't read again
   * for it until it changes. A match is always hashed again, on the bytes returned.
   */
  private readonly diskHashes = new Map<string, string>();
  /** The revisions listings named at their paths (`heldKey`), the latest listed last. */
  private readonly listed = new Map<string, RevisionFile>();
  /** The workspace folders listed (or being listed), by workspace and folder, until the workspace changes. */
  private readonly listedFolders = new Map<string, Promise<void>>();

  constructor({ cm, maxListed = MAX_LISTED_REVISIONS }: WorkspaceCopiesOptions = {}) {
    this.cm = cm;
    this.maxListed = maxListed;
  }

  /**
   * Remembers the revisions a listing named in the workspace (the Files view's folders, Browse repository's, a
   * history's file, a point's tree beside a model): which revision is at each path, and the size and hash that tell
   * it. A revision's content never changes, so a listing gone stale only misses a copy; the disk is checked at each read.
   */
  remember(workspacePath: string, files: Iterable<RevisionFile>): void {
    for (const file of files) {
      const path = workspacePathOf(file.path);
      if (file.hash === null || file.revision.revisionId <= 0 || path === null) continue;
      const key = heldKey(workspacePath, path, file.revision);
      this.listed.delete(key);
      this.listed.set(key, { ...file, path });
    }
    for (const oldest of this.listed.keys()) {
      if (this.listed.size <= this.maxListed) break;
      this.listed.delete(oldest);
    }
  }

  /**
   * Remembers a workspace folder's own listing (the Files view's `cm ls --xml`): its files' revisions, and that a
   * revision it doesn't name isn't there, so the folder isn't listed again for one until the workspace changes.
   */
  rememberFolder(workspacePath: string, folder: string, files: Iterable<RevisionFile>): void {
    this.remember(workspacePath, files);
    this.keepFolderListing(folderKey(workspacePath, folder), Promise.resolve());
  }

  /** The workspace changed (the watcher saw it, or stopped watching): its folders are listed again when asked. */
  forgetListings(workspacePath: string): void {
    for (const key of [...this.listedFolders.keys()]) if (key.startsWith(`${workspacePath}\0`)) this.listedFolders.delete(key);
  }

  /**
   * The revision's bytes from the workspace's disk, where the file at its path has its content; null where it hasn't,
   * and the reader downloads it. With its hash (a listing the reader has), the disk is checked against it. Without
   * (a diff's, a history's revision), the workspace tells which revision it holds there, with its size and hash: only
   * where the disk has a file at the path, from a listing remembered or one `cm ls` of its folder.
   */
  async read(workspacePath: string, file: RevisionFile): Promise<Buffer | null> {
    if (file.hash !== null) return this.matching(workspacePath, file);
    const held = await this.heldAt(workspacePath, file);
    return held ? this.matching(workspacePath, held) : null;
  }

  /** The workspace's listing of the revision at the reader's path, when the workspace holds that very revision there. */
  private async heldAt(workspacePath: string, file: RevisionFile): Promise<RevisionFile | null> {
    const path = workspacePathOf(file.path);
    if (path === null) return null;
    const key = heldKey(workspacePath, path, file.revision);
    const known = this.listed.get(key);
    if (known || !this.cm) return known ?? null;
    const onDisk = await stat(workspaceFileOf(workspacePath, path)).then((stats) => stats.isFile(), () => false);
    if (!onDisk) return null;
    await this.listFolder(workspacePath, path.includes('/') ? dirname(path) : '');
    return this.listed.get(key) ?? null;
  }

  /** One `cm ls` of the workspace folder while the workspace doesn't change, its files remembered; a failure lists nothing. */
  private listFolder(workspacePath: string, folder: string): Promise<void> {
    const key = folderKey(workspacePath, folder);
    const listing =
      this.listedFolders.get(key) ??
      this.cm!.query(workspaceListingArgs(toAbsolutePath(workspacePath, folder)), { cwd: workspacePath }).then(
        (output) => this.remember(workspacePath, parseWorkspaceListing(output)),
        () => undefined,
      );
    this.keepFolderListing(key, listing);
    return listing;
  }

  private keepFolderListing(key: string, listing: Promise<void>): void {
    this.listedFolders.delete(key);
    this.listedFolders.set(key, listing);
    for (const oldest of this.listedFolders.keys()) {
      if (this.listedFolders.size <= MAX_LISTED_FOLDERS) break;
      this.listedFolders.delete(oldest);
    }
  }

  /**
   * The disk's file at the revision's path, when it has the revision's content: the same size, and the same MD5 as
   * the hash listed. Null where it hasn't, isn't there, or is past `MAX_MODEL_BYTES`.
   */
  private async matching(workspacePath: string, file: RevisionFile): Promise<Buffer | null> {
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

/**
 * A path as the workspace's listings write it: `/`-separated, without a leading `/` (a repository path), composed
 * (macOS lists names decomposed). Null for one leading out of the workspace: nothing is looked up for it.
 */
function workspacePathOf(path: string): string | null {
  const parts = path.replaceAll('\\', '/').normalize('NFC').split('/').filter((part) => part !== '');
  return parts.includes('..') ? null : parts.join('/');
}

/**
 * A revision at a workspace path. The repository by its name alone: `cm` spells a cloud repository's server two ways
 * (`name@<organization>@unity` in `cm ls`, `name@<id>@cloud` in `cm history --xml`), and at one path the workspace holds
 * one repository's item; the content check stands behind it.
 */
/** A workspace folder, as `forgetListings` finds it by its workspace. */
function folderKey(workspacePath: string, folder: string): string {
  return `${workspacePath}\0${workspacePathOf(folder) ?? folder}`;
}

function heldKey(workspacePath: string, path: string, revision: RevisionRef): string {
  return `${workspacePath}\0${path}\0${revision.revisionId}\0${revision.repository.split('@')[0]}`;
}

function diskKey(path: string, size: number, modified: number): string {
  return `${path}\0${size}\0${modified}`;
}
