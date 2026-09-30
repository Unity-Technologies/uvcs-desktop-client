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
  private readonly watchers = new Map<string, FolderWatch>();
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
    return this.complete && this.watchers.has('');
  }

  close(): void {
    this.closed = true;
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers.clear();
  }

  /** Level by level, so a tree past the limit still has its root, `.plastic` and upper folders watched. */
  private watchTree(top: string): void {
    const pending = [top];
    for (let next = 0; next < pending.length && !this.closed; next++) {
      const folder = pending[next]!;
      if (this.watchers.has(folder) || (folder && this.skip(folder))) continue;
      if (this.watchers.size >= this.maxFolders || !this.watchFolder(folder)) {
        this.complete = false;
        continue;
      }
      for (const entry of this.list(folder)) {
        if (entry.isDirectory()) pending.push(childOf(folder, entry.name));
      }
    }
  }

  private watchFolder(folder: string): boolean {
    try {
      const watcher = this.watch(this.absolute(folder), false, (event, name) => this.onFolderEvent(folder, event, name));
      watcher.onError(() => this.unwatch(folder));
      this.watchers.set(folder, watcher);
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
    for (const [watched, watcher] of this.watchers) {
      if (watched === folder || watched.startsWith(`${folder}/`) || folder === '') {
        watcher.close();
        this.watchers.delete(watched);
      }
    }
  }

  private list(folder: string) {
    try {
      return readdirSync(this.absolute(folder), { withFileTypes: true });
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
