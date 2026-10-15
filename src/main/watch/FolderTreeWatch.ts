import { lstatSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { watchFolder, type FolderWatch, type WatchFolder } from './watchFolder';

/**
 * Folders watched in one go before the walk waits for their listings: the main process answers the windows in
 * between, so a big tree (thousands of folders) never holds it for more than a few milliseconds.
 */
export const FOLDERS_PER_STEP = 64;

/** The names of the folders directly inside a folder (an absolute path); none when it can't be read. */
export type ListSubfolders = (folder: string) => Promise<string[]>;

/** Links to folders aren't listed (`Dirent.isDirectory` doesn't follow them): they're never followed, as `cm` doesn't. */
export const listSubfoldersOnDisk: ListSubfolders = async (folder) => {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
};

/**
 * A recursive watch made of one plain watch per folder, where `fs.watch` has no native recursion (Linux). Node's own
 * recursive mode there adds an inotify watch per file, not per folder, and loses a file for good once it's saved by
 * replacing it (most editors' safe save): a folder's watch reports its items by name, whatever happens to them.
 * New folders are watched as they appear and removed ones dropped; skipped folders (ignored ones) are never walked,
 * and follow the rule as it changes (`followSkipRule`). Past `maxFolders` the rest goes unwatched, and the tree is
 * incomplete. Once started, a watch that breaks or a new folder that can't be watched makes it incomplete too, and it
 * tells (`onBroken`). The tree is walked asynchronously, a step at a time (`FOLDERS_PER_STEP`), the main process answering
 * in between: each folder is watched before it's listed, so a folder created meanwhile is reported and walked too.
 */
export class FolderTreeWatch {
  /** By workspace-relative, `/`-separated folder (`''` for the root). */
  private readonly watches = new Map<string, FolderWatch>();
  /** The folders met and skipped, so they are walked if the rule stops skipping them. */
  private readonly skipped = new Set<string>();
  /** The walks under way: the first one, and those of folders that appeared or stopped being skipped. */
  private readonly walks = new Set<Promise<void>>();
  private complete = true;
  private started = false;
  private closed = false;

  constructor(
    private readonly root: string,
    private readonly skip: (relativeFolder: string) => boolean,
    private readonly onEvent: (event: string, relativePath: string | undefined) => void,
    private readonly onBroken: () => void,
    private readonly maxFolders: number,
    private readonly watch: WatchFolder = watchFolder,
    private readonly listSubfolders: ListSubfolders = listSubfoldersOnDisk,
  ) {}

  /**
   * Watches the tree, once walked; false if some folder couldn't be watched (none at all, past the limit, out of
   * inotify watches), or if it was closed meanwhile. While folders keep appearing, it waits for their walks too.
   */
  async start(): Promise<boolean> {
    // With the walks of folders that appeared meanwhile: what one of them can't watch, this answer tells.
    void this.walk('');
    await this.walksDone();
    this.started = true;
    return this.complete && this.watches.has('');
  }

  /** Resolves once no walk is under way: the first one, nor one of a folder that appeared or stopped being skipped. */
  async walksDone(): Promise<void> {
    while (this.walks.size > 0) await Promise.all(this.walks);
  }

  close(): void {
    this.closed = true;
    this.watches.forEach((watch) => watch.close());
    this.watches.clear();
    this.skipped.clear();
  }

  /** What `skip` says changed (ignore.conf was edited): stops watching the folders it skips now, walks the ones it no longer does. */
  followSkipRule(): void {
    for (const folder of [...this.watches.keys()]) {
      if (!folder || !this.watches.has(folder) || !this.skip(folder)) continue;
      this.unwatch(folder);
      this.skipped.add(folder);
    }
    for (const folder of [...this.skipped]) {
      if (this.skip(folder)) continue;
      this.skipped.delete(folder);
      if (this.isFolder(folder)) void this.walk(folder);
    }
  }

  private walk(top: string): Promise<void> {
    const walk = this.watchTree(top).finally(() => this.walks.delete(walk));
    this.walks.add(walk);
    return walk;
  }

  /**
   * Level by level, so a tree past the limit still has its root, `.plastic` and upper folders watched. Stops once
   * closed: nothing is watched after `close()`.
   */
  private async watchTree(top: string): Promise<void> {
    const pending = [top];
    while (pending.length > 0 && !this.closed) {
      const watched = pending.splice(0, FOLDERS_PER_STEP).filter((folder) => this.watchMet(folder));
      const listings = await Promise.all(watched.map((folder) => this.subfolders(folder)));
      for (const subfolders of listings) pending.push(...subfolders);
    }
  }

  /** Watches a folder the walk met, unless it's watched already or skipped; whether to walk inside it. */
  private watchMet(folder: string): boolean {
    if (this.closed || this.watches.has(folder)) return false;
    // Its parent stopped being watched since it was listed (deleted, moved, now skipped): neither is this one.
    if (folder && !this.watches.has(parentOf(folder))) return false;
    if (folder && this.skip(folder)) {
      this.skipped.add(folder);
      return false;
    }
    if (this.watches.size >= this.maxFolders) {
      this.becomeIncomplete();
      return false;
    }
    if (!this.watchFolder(folder)) {
      // A folder deleted since it was listed is no loss; one still there that can't be watched is.
      if (this.isFolder(folder)) this.becomeIncomplete();
      return false;
    }
    return true;
  }

  private watchFolder(folder: string): boolean {
    try {
      const watch = this.watch(this.absolute(folder), false, (event, name) => this.onFolderEvent(folder, event, name));
      watch.onError(() => {
        this.unwatch(folder);
        this.becomeIncomplete();
      });
      this.watches.set(folder, watch);
      return true;
    } catch {
      return false;
    }
  }

  private onFolderEvent(folder: string, event: string, name: string | null): void {
    if (this.closed) return;
    const path = name === null ? undefined : childOf(folder, name);
    this.onEvent(event, path);
    // Additions, deletions and moves arrive as 'rename' on the folder holding the item.
    if (path === undefined || event !== 'rename') return;
    if (this.isFolder(path)) void this.walk(path);
    else this.unwatch(path);
  }

  /** Some folder goes unwatched: said by `start()`'s answer while starting, by `onBroken` afterwards. */
  private becomeIncomplete(): void {
    this.complete = false;
    if (this.started && !this.closed) this.onBroken();
  }

  /** Stops watching a folder gone, moved or now skipped, and everything that was under it. */
  private unwatch(folder: string): void {
    for (const skipped of this.skipped) {
      if (isSameOrUnder(skipped, folder)) this.skipped.delete(skipped);
    }
    // Folders are watched from the top down, so nothing under an unwatched path is watched: a file deleted or saved
    // by replacing it (every save, for most editors) looks at no other watch.
    if (!this.watches.has(folder)) return;
    for (const [watched, watch] of this.watches) {
      if (isSameOrUnder(watched, folder)) {
        watch.close();
        this.watches.delete(watched);
      }
    }
  }

  /** The folders directly inside `folder`, workspace-relative. */
  private async subfolders(folder: string): Promise<string[]> {
    const names = await this.listSubfolders(this.absolute(folder));
    return names.map((name) => childOf(folder, name));
  }

  /** A folder, not a link to one: links are never followed, as `cm` doesn't. */
  private isFolder(path: string): boolean {
    try {
      return lstatSync(this.absolute(path), { throwIfNoEntry: false })?.isDirectory() === true;
    } catch {
      return false;
    }
  }

  private absolute(relativePath: string): string {
    return relativePath ? join(this.root, ...relativePath.split('/')) : this.root;
  }
}

function childOf(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

function parentOf(folder: string): string {
  const slash = folder.lastIndexOf('/');
  return slash < 0 ? '' : folder.slice(0, slash);
}

/** Whether `path` is `folder` or inside it; everything is inside the root (`''`). */
function isSameOrUnder(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}
