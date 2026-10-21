import { join, relative } from 'node:path';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import { isSameOrInside } from '../files/pathContainment';
import { ChangeBatcher } from './ChangeBatcher';
import { changedFolder } from './changedFolder';
import { ANY_FILE_EDIT, classifyChange, isChangelistFile, workspaceChangeOf } from './classifyChange';
import { FolderTreeWatch } from './FolderTreeWatch';
import { isIgnored, NO_IGNORE_RULES, readIgnoreRules, type IgnoreRules } from './ignoreRules';
import { OwnWrites } from './OwnWrites';
import { watchFolder, type FolderWatch, type WatchFolder } from './watchFolder';

const QUIET_MS = 300;
const MAX_WAIT_MS = 2000;
/** One native stream for the whole tree (FSEvents, ReadDirectoryChangesW). Elsewhere (Linux), a watch per folder. */
const RECURSIVE_WATCH_PLATFORMS = new Set<NodeJS.Platform>(['darwin', 'win32']);
/**
 * Folders watched one by one at most (outside ignored ones): each takes an inotify watch, and a user's watches are
 * shared by all their apps (8,192 on kernels before 5.11, more since). A bigger tree is watched in part.
 */
const MAX_WATCHED_FOLDERS = 10_000;

/**
 * Watches a workspace and reports what changed, in coalesced batches: file edits (pending changes) apart
 * from `.plastic` state rewrites (checkin, update, switch... by any tool). Changes caused by the app's own writes
 * are dropped, because the app refreshes its views after them anyway. A watch that breaks once started (the platform
 * gave up on it, Linux ran out of watches) is told once (`onBroken`), if it saw every change until then.
 */
export class WorkspaceWatcher {
  /** The native watches where the platform recurses (`RECURSIVE_WATCH_PLATFORMS`). */
  private watches: FolderWatch[] = [];
  /** Elsewhere, a watch per folder. */
  private folderTree: FolderTreeWatch | null = null;
  private ignoreRules: IgnoreRules = NO_IGNORE_RULES;
  private readonly ownWrites = new OwnWrites();
  private readonly ownChangelistWrites = new OwnWrites();
  private stopped = false;
  /** Seeing only part of the changes: from the start (the answer of `start()` says so), or since a watch broke. */
  private partial = false;
  private readonly batcher: ChangeBatcher;

  constructor(
    readonly workspacePath: string,
    private readonly onChanged: (change: WorkspaceChange) => void,
    private readonly onBroken: () => void,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly watch: WatchFolder = watchFolder,
  ) {
    this.batcher = new ChangeBatcher((change) => this.report(change), QUIET_MS, MAX_WAIT_MS);
  }

  /**
   * Answers once watching: on Linux, once every folder has its watch (`FolderTreeWatch`); while folders keep
   * appearing, it waits for them too.
   */
  async start(): Promise<WatchCoverage> {
    this.loadIgnoreRules();
    const coverage = RECURSIVE_WATCH_PLATFORMS.has(this.platform) ? this.watchRecursively() : await this.watchFolderByFolder();
    // Only ever set, as a guard: no watch can break before start answers today (`onBroken` comes only once a watch
    // has started, and only microtasks run between that and this line), but a watch told broken must stay so.
    if (coverage === 'partial') this.partial = true;
    return coverage;
  }

  /** Whether a command run in `cwd` works on this workspace (`C:\Work` and `c:\work` are one folder on Windows). */
  covers(cwd: string): boolean {
    return isSameOrInside(this.workspacePath, cwd, this.platform);
  }

  /** Ignores changes until `write` settles; with `changelists`, only the rewrites of the changelist files. */
  ignoreOwnWrite(write: Promise<unknown>, only?: 'changelists'): void {
    if (only === 'changelists') {
      this.ownChangelistWrites.track(write);
      return;
    }
    this.ownWrites.track(write);
    this.batcher.cancel();
  }

  stop(): void {
    this.stopped = true;
    this.watches.forEach((watch) => watch.close());
    this.watches = [];
    this.folderTree?.close();
    this.batcher.cancel();
  }

  private watchRecursively(): WatchCoverage {
    if (this.tryWatch(this.workspacePath, true)) return 'full';
    // Without recursion, edits in subfolders go unnoticed; the root and `.plastic` still report checkins, switches...
    this.tryWatch(this.workspacePath, false);
    this.tryWatch(join(this.workspacePath, '.plastic'), false);
    return 'partial';
  }

  private async watchFolderByFolder(): Promise<WatchCoverage> {
    this.folderTree = new FolderTreeWatch(
      this.workspacePath,
      (folder) => isIgnored(folder, this.ignoreRules),
      (event, relativePath) => this.onEvent(event, relativePath),
      () => this.tellBroken(),
      MAX_WATCHED_FOLDERS,
      this.watch,
    );
    if (!(await this.folderTree.start())) return 'partial';
    // A file edited in a folder whose watch wasn't there yet went unseen: the windows (and what keeps something of the
    // files) read everything again once, as they take the workspace as fully watched from now on.
    this.report(ANY_FILE_EDIT);
    return 'full';
  }

  private report(change: WorkspaceChange): void {
    if (!this.stopped) this.onChanged(change);
  }

  private tryWatch(path: string, recursive: boolean): boolean {
    try {
      const watch = this.watch(path, recursive, (event, fileName) => {
        const relativePath = fileName === null ? undefined : relative(this.workspacePath, join(path, fileName));
        this.onEvent(event, relativePath);
      });
      watch.onError(() => {
        watch.close();
        this.tellBroken();
      });
      this.watches.push(watch);
      return true;
    } catch {
      return false;
    }
  }

  /** A watch broke: told once, when the watcher goes from seeing every change to seeing part of them. */
  private tellBroken(): void {
    if (this.partial || this.stopped) return;
    this.partial = true;
    this.onBroken();
  }

  private onEvent(event: string, relativePath: string | undefined): void {
    if (this.stopped) return;
    if (relativePath === 'ignore.conf') {
      this.loadIgnoreRules();
      this.folderTree?.followSkipRule();
    }
    const kind = classifyChange(relativePath, this.ignoreRules);
    if (!kind || this.causedByOwnWrite(relativePath)) return;
    this.batcher.add(workspaceChangeOf(kind, event, changedFolder(relativePath, this.platform)));
  }

  private causedByOwnWrite(relativePath: string | undefined): boolean {
    return this.ownWrites.active() || (isChangelistFile(relativePath) && this.ownChangelistWrites.active());
  }

  /** Read at once, before any folder is walked: a watch per folder skips ignored ones. */
  private loadIgnoreRules(): void {
    this.ignoreRules = readIgnoreRules(this.workspacePath);
  }
}
