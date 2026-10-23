// The workspace's own copies of revisions (ARCHITECTURE.md "Server budget", "Revisions on disk"): every revision a
// view reads is looked for on the workspace's disk before it is downloaded with `cm cat`. Which file, which revision:
// the revision's path and id. Does the disk have that file, and is it that revision, unchanged? The workspace tells
// which revision it loaded at the path, and its size and hash (`cm ls`, one listing per folder), and the file's bytes
// must have that size and MD5. Then the disk's bytes are read; otherwise the revision is downloaded. Content decides,
// never status: a file changed, being written, checked out (revision -1) or holding another revision is downloaded.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { posix } from 'node:path';
import type { RevisionRef } from '@shared/domain/revision';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import type { CmClient } from '../cm/CmClient';
import { OwnCopies, ownCopy } from '../cm/ownCopy';
import type { ListedTreeItem } from '../cm/treeItems';
import { readWorkspaceListedItem, workspaceListingArgs } from '../cm/workspaceListing';
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
  cm?: Pick<CmClient, 'queryRecords'>;
  /** The most listed revisions remembered; tests pass a few. */
  maxListed?: number;
}

export class WorkspaceCopies {
  private readonly cm: Pick<CmClient, 'queryRecords'> | undefined;
  private readonly maxListed: number;
  /**
   * The hashes of disk files, by path, size and time written: a file known to differ from a revision isn't read again
   * for it until it changes. A match is always hashed again, on the bytes returned.
   */
  private readonly diskHashes = new Map<string, string>();
  /** The revisions listings named at their paths (`heldKey`), the latest listed last. */
  private readonly listed = new Map<string, RevisionFile>();
  /**
   * The paths the workspace told which revision it holds at, by folder (`folderKey`), the latest told last: its own
   * listings (the Files view's, a history's `cm ls` of its file, a folder's). A path known here answers any other
   * revision with no command. By folder, so a change forgets one folder's at once.
   */
  private readonly held = new Map<string, Set<string>>();
  /** The workspace folders listed (or being listed), by workspace and folder, until the workspace changes. */
  private readonly listedFolders = new Map<string, Promise<void>>();
  /** How many times each workspace was seen to change (`generationOf`). */
  private readonly generations = new Map<string, number>();
  /** The repository specs the listings name, one copy each (`kept`). */
  private readonly repositories = new OwnCopies();

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
    this.keepListed(workspacePath, this.kept(files));
  }

  private keepListed(workspacePath: string, kept: Iterable<RevisionFile>): void {
    for (const file of kept) keepLatest(this.listed, heldKey(workspacePath, file.path, file.revision), file, this.maxListed);
  }

  /**
   * The files that tell a revision (`validFiles`), as strings of their own (`ownCopy`): what a listing names are slices
   * of its whole output, and up to `MAX_LISTED_REVISIONS` of them are kept, so a few would keep every listing read.
   */
  private *kept(files: Iterable<RevisionFile>): Generator<RevisionFile> {
    for (const { path, revision, hash, size } of validFiles(files)) {
      const repository = this.repositories.of(revision.repository);
      yield { path: ownCopy(path), revision: { revisionId: revision.revisionId, repository }, hash: hash && ownCopy(hash), size };
    }
  }

  /**
   * The workspace's state as last seen to change: taken as a listing of it is asked, and handed back with what it
   * told (`listedAt`). A listing asked before the workspace changed tells the state before: its hashes still serve the
   * revisions it named, but nothing of it counts as held.
   */
  generationOf(workspacePath: string): number {
    return this.generations.get(workspacePath) ?? 0;
  }

  /**
   * Remembers what the workspace itself told it holds at each path (its own `cm ls`: a history's of its file, a
   * folder's): any other revision asked there is not on its disk, with no command. Only from a listing asked since the
   * workspace last changed (`listedAt`); an older one's revisions are only remembered.
   */
  rememberHeld(workspacePath: string, files: Iterable<RevisionFile>, listedAt = this.generationOf(workspacePath)): void {
    const valid = [...this.kept(files)];
    this.keepListed(workspacePath, valid);
    if (listedAt !== this.generationOf(workspacePath)) return;
    for (const file of valid) {
      const folder = folderKey(workspacePath, folderOf(file.path));
      keepLatest(this.held, folder, (this.held.get(folder) ?? new Set<string>()).add(file.path), MAX_LISTED_FOLDERS);
    }
  }

  /**
   * Remembers a workspace folder's own listing (the Files view's `cm ls`, `parseTreeItems`): its files' revisions, and that a
   * revision it doesn't name isn't there, so the folder isn't listed again for one until the workspace changes.
   */
  rememberFolder(workspacePath: string, folder: string, files: Iterable<RevisionFile>, listedAt = this.generationOf(workspacePath)): void {
    this.rememberHeld(workspacePath, files, listedAt);
    if (listedAt === this.generationOf(workspacePath)) this.keepFolderListing(folderKey(workspacePath, folder), Promise.resolve());
  }

  /**
   * The watcher saw the workspace change: what it held is asked again where it may differ. Every folder once `cm`
   * rewrote the workspace's state (`metadata`: an update, a checkin, an undo) or the watcher couldn't tell where; else
   * only the folders whose files changed, so an app writing elsewhere all the time (a Unity editor) never makes every
   * diff list its folders again.
   */
  forgetChanged(workspacePath: string, change: WorkspaceChange): void {
    if (change.metadata || change.folders === null) return this.forgetListings(workspacePath);
    this.generations.set(workspacePath, this.generationOf(workspacePath) + 1);
    for (const folder of change.folders) {
      const key = folderKey(workspacePath, folder);
      this.listedFolders.delete(key);
      this.held.delete(key);
    }
  }

  /** The workspace changed everywhere, or isn't watched anymore: its folders are listed again when asked. */
  forgetListings(workspacePath: string): void {
    this.generations.set(workspacePath, this.generationOf(workspacePath) + 1);
    for (const map of [this.listedFolders, this.held]) for (const key of [...map.keys()]) if (key.startsWith(`${workspacePath}\0`)) map.delete(key);
  }

  /**
   * The revision's bytes from the workspace's disk, where the file at its path has its content; null where it hasn't,
   * and the reader downloads it. With its hash (a listing the reader has), the disk is checked against it. Without
   * (a diff's, a history's revision), the workspace tells which revision it holds there, with its size and hash: only
   * where the disk has a file at the path, from a listing remembered or one `cm ls` of its folder.
   */
  async read(workspacePath: string, file: RevisionFile): Promise<Buffer | null> {
    return (await this.matchingOnDisk(workspacePath, file, true))?.bytes ?? null;
  }

  /**
   * Whether the workspace's disk has the revision's content, checked as `read` checks it, but keeping none of the
   * bytes: what decides a download for a read to come (`RevisionDownloads.fetch`).
   */
  async has(workspacePath: string, file: RevisionFile): Promise<boolean> {
    return (await this.matchingOnDisk(workspacePath, file, false)) !== null;
  }

  private async matchingOnDisk(workspacePath: string, file: RevisionFile, keepBytes: boolean): Promise<{ bytes: Buffer | null } | null> {
    if (file.hash !== null) return this.matching(workspacePath, file, keepBytes);
    const held = await this.heldAt(workspacePath, file);
    return held ? this.matching(workspacePath, held, keepBytes) : null;
  }

  /** The workspace's listing of the revision at the reader's path, when the workspace holds that very revision there. */
  private async heldAt(workspacePath: string, file: RevisionFile): Promise<RevisionFile | null> {
    const path = workspacePathOf(file.path);
    if (path === null) return null;
    const key = heldKey(workspacePath, path, file.revision);
    const known = this.listed.get(key) ?? null;
    // The workspace told what it holds there: this revision (`known`), or another.
    if (known || this.held.get(folderKey(workspacePath, folderOf(path)))?.has(path) || !this.cm) return known;
    const onDisk = await stat(workspaceFileOf(workspacePath, path)).then((stats) => stats.isFile(), () => false);
    if (!onDisk) return null;
    await this.listFolder(workspacePath, folderOf(path));
    return this.listed.get(key) ?? null;
  }

  /** One `cm ls` of the workspace folder while the workspace doesn't change, its files remembered; a failure lists nothing. */
  private listFolder(workspacePath: string, folder: string): Promise<void> {
    const key = folderKey(workspacePath, folder);
    const kept = this.listedFolders.get(key);
    if (kept) return kept;
    const listedAt = this.generationOf(workspacePath);
    const args = workspaceListingArgs(toAbsolutePath(workspacePath, folder));
    const listing: Promise<void> = this.cm!.queryRecords(args, readWorkspaceListedItem, { cwd: workspacePath }).then(
      (files) => {
        this.rememberHeld(workspacePath, files, listedAt);
        // Asked before the workspace changed: the folder is listed again for the next read.
        if (listedAt !== this.generationOf(workspacePath) && this.listedFolders.get(key) === listing) this.listedFolders.delete(key);
      },
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
  private async matching(workspacePath: string, file: RevisionFile, keepBytes: boolean): Promise<{ bytes: Buffer | null } | null> {
    const absolutePath = workspaceFileOf(workspacePath, file.path);
    const stats = await stat(absolutePath).catch(() => null);
    if (!stats?.isFile() || (file.size >= 0 && stats.size !== file.size) || stats.size > MAX_MODEL_BYTES) return null;
    const key = diskKey(absolutePath, stats.size, stats.mtimeMs);
    const known = this.diskHashes.get(key);
    if (known !== undefined && known !== file.hash) return null;
    // Without the bytes, the hash known for the file as it is now answers (`has`): the read that follows hashes them.
    if (known !== undefined && !keepBytes) return { bytes: null };
    const read = await readHashed(absolutePath, stats.size, keepBytes).catch(() => null);
    if (!read) return null;
    if (this.diskHashes.size >= MAX_DISK_HASHES) this.diskHashes.clear();
    this.diskHashes.set(key, read.hash);
    return read.hash === file.hash ? { bytes: read.bytes } : null;
  }
}

/**
 * A file's bytes (when `keepBytes`) and their MD5, hashed chunk by chunk as they are read: a 100 MB model never blocks
 * the main process while it is hashed. The bytes hashed are the bytes returned, so a file written meanwhile can't pass
 * for a revision. Read into one buffer of the size the file had (`size`), never chunks joined at the end, which held
 * each file twice. Null for one that grew past it while read.
 */
async function readHashed(absolutePath: string, size: number, keepBytes: boolean): Promise<{ bytes: Buffer | null; hash: string } | null> {
  const hash = createHash('md5');
  const bytes = keepBytes ? Buffer.allocUnsafe(size) : null;
  let read = 0;
  for await (const chunk of createReadStream(absolutePath) as AsyncIterable<Buffer>) {
    if (read + chunk.length > size) return null;
    hash.update(chunk);
    bytes?.set(chunk, read);
    read += chunk.length;
  }
  return { bytes: bytes?.subarray(0, read) ?? null, hash: hash.digest('base64') };
}

/**
 * The files of a `cm ls` listing (`parseTreeItems`) as the revisions they hold: neither folders nor links, nor a private item or a
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

/** The files that tell a revision, at their paths as the workspace's listings write them. */
function* validFiles(files: Iterable<RevisionFile>): Generator<RevisionFile> {
  for (const file of files) {
    const path = workspacePathOf(file.path);
    if (file.hash !== null && file.revision.revisionId > 0 && path !== null) yield { ...file, path };
  }
}

/** Sets the key as the latest, letting the oldest go past `max`. */
function keepLatest<T>(map: Map<string, T>, key: string, value: T, max: number): void {
  map.delete(key);
  map.set(key, value);
  for (const oldest of map.keys()) {
    if (map.size <= max) break;
    map.delete(oldest);
  }
}

/** The folder of a workspace path, `''` for the root's files. */
function folderOf(path: string): string {
  return path.includes('/') ? posix.dirname(path) : '';
}

/** A workspace folder, as `forgetListings` finds it by its workspace. */
function folderKey(workspacePath: string, folder: string): string {
  return `${workspacePath}\0${workspacePathOf(folder) ?? folder}`;
}

/**
 * A revision at a workspace path, in its repository by its whole spec, server included: revision ids are per
 * repository, and two servers may each have a `game` (replicas too). Every spec compared here names a Unity
 * organization's server by name (ARCHITECTURE.md "Unity organizations": `cm ls`, `cm diff`, and History's revisions,
 * `withServerOf`); one left by its id, where `cm` couldn't name it, only misses its copy and is downloaded.
 */
function heldKey(workspacePath: string, path: string, revision: RevisionRef): string {
  return `${workspacePath}\0${path}\0${revision.revisionId}\0${revision.repository}`;
}

function diskKey(path: string, size: number, modified: number): string {
  return `${path}\0${size}\0${modified}`;
}
