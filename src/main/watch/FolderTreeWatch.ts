import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { watchFolder, type FolderWatch, type WatchFolder } from './watchFolder';

/**
 * A recursive watch made of one plain watch per folder, where `fs.watch` has no native recursion (Linux). Node's own
 * recursive mode there adds an inotify watch per file, not per folder, and loses a file for good once it's saved by
 * replacing it (most editors' safe save): a folder's watch reports its items by name, whatever happens to them.
 * New folders are watched as they appear and removed ones dropped; skipped folders (ignored ones) are never walked.
 * Past `maxFolders` the rest goes unwatched, and the tree is incomplete.
 */
export class FolderTreeWatch {
  /** By workspace-relative, `/`-separated folder (`''` for the root). */
  private readonly watches = new Map<string, FolderWatch>();
  private complete = true;
  private closed = false;

  constructor(
    private readonly root: string,
    private readonly skip: (relativeFolder: string) => boolean,
    private readonly onEvent: (event: string, relativePath: string | undefined) => void,
    private readonly maxFolders: number,
    private readonly watch: WatchFolder = watchFolder,
  ) {}

  /** Watches the tree; false if some folder couldn't be watched (none at all, past the limit, out of inotify watches). */
  start(): boolean {
    this.watchTree('');
    return this.complete && this.watches.has('');
  }

  close(): void {
    this.closed = true;
    this.watches.forEach((watch) => watch.close());
    this.watches.clear();
  }

  /** Level by level, so a tree past the limit still has its root, `.plastic` and upper folders watched. */
  private watchTree(top: string): void {
    const pending = [top];
    for (let next = 0; next < pending.length && !this.closed; next++) {
      const folder = pending[next]!;
      if (this.watches.has(folder) || (folder && this.skip(folder))) continue;
      if (this.watches.size >= this.maxFolders || !this.watchFolder(folder)) {
        this.complete = false;
        continue;
      }
      for (const subfolder of this.subfolders(folder)) pending.push(subfolder);
    }
  }

  private watchFolder(folder: string): boolean {
    try {
      const watch = this.watch(this.absolute(folder), false, (event, name) => this.onFolderEvent(folder, event, name));
      watch.onError(() => this.unwatch(folder));
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
    if (this.isFolder(path)) this.watchTree(path);
    else this.unwatch(path);
  }

  /** Stops watching a folder gone (or moved) and everything that was under it. */
  private unwatch(folder: string): void {
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

  /** The folders directly inside `folder` (links to folders aren't: `Dirent.isDirectory` doesn't follow them). */
  private subfolders(folder: string): string[] {
    try {
      const entries = readdirSync(this.absolute(folder), { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => childOf(folder, entry.name));
    } catch {
      return [];
    }
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

/** Whether `path` is `folder` or inside it; everything is inside the root (`''`). */
function isSameOrUnder(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}
