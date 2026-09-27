import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceChange } from '@shared/events';
import { isSameOrInside } from '../files/pathContainment';
import { ChangeBatcher } from './ChangeBatcher';
import { changedFolder } from './changedFolder';
import { classifyChange, isChangelistFile } from './classifyChange';
import { NO_IGNORE_RULES, parseIgnoreRules, type IgnoreRules } from './ignoreRules';

const QUIET_MS = 300;
const MAX_WAIT_MS = 2000;
/** File system events arrive a little after the write that caused them. */
const AFTER_OWN_WRITE_GRACE_MS = 250;
/** One native stream for the whole tree (FSEvents, ReadDirectoryChangesW). On Linux, Node would add an inotify watch per directory, including ignored ones. */
const RECURSIVE_WATCH_PLATFORMS = new Set<NodeJS.Platform>(['darwin', 'win32']);

/**
 * Watches a workspace and reports what changed, in coalesced batches: file edits (pending changes) apart
 * from `.plastic` state rewrites (checkin, update, switch... by any tool). Changes caused by the app's own writes
 * are dropped, because the app refreshes its views after them anyway.
 */
export class WorkspaceWatcher {
  private watchers: FSWatcher[] = [];
  private ignoreRules: IgnoreRules = NO_IGNORE_RULES;
  private readonly ownWrites = new OwnWrites();
  private readonly ownChangelistWrites = new OwnWrites();
  private stopped = false;
  private readonly batcher: ChangeBatcher;

  constructor(
    readonly workspacePath: string,
    onChanged: (change: WorkspaceChange) => void,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {
    this.batcher = new ChangeBatcher((change) => !this.stopped && onChanged(change), QUIET_MS, MAX_WAIT_MS);
  }

  start(): WatchCoverage {
    void this.loadIgnoreRules();
    if (RECURSIVE_WATCH_PLATFORMS.has(this.platform) && this.tryWatch(this.workspacePath, true)) return 'full';
    // Without recursion, edits in subfolders go unnoticed; the root and `.plastic` still report checkins, switches...
    this.tryWatch(this.workspacePath, false);
    this.tryWatch(join(this.workspacePath, '.plastic'), false);
    return 'partial';
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
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
    this.batcher.cancel();
  }

  private tryWatch(path: string, recursive: boolean): boolean {
    try {
      const watcher = watch(path, { recursive }, (event, fileName) => {
        const relativePath = fileName === null ? undefined : relative(this.workspacePath, join(path, fileName));
        this.onEvent(event, relativePath);
      });
      watcher.on('error', () => watcher.close());
      this.watchers.push(watcher);
      return true;
    } catch {
      return false;
    }
  }

  private onEvent(event: string, relativePath: string | undefined): void {
    if (this.stopped) return;
    if (relativePath === 'ignore.conf') void this.loadIgnoreRules();
    const kind = classifyChange(relativePath, this.ignoreRules);
    if (!kind || this.ownWrites.active()) return;
    if (isChangelistFile(relativePath) && this.ownChangelistWrites.active()) return;
    const folder = changedFolder(relativePath, this.platform);
    const anything = kind === 'anything';
    this.batcher.add({
      content: kind === 'content' || anything,
      // Node reports additions, deletions and moves as 'rename'; content edits as 'change'.
      pathsChanged: (kind === 'content' && event === 'rename') || anything,
      metadata: kind === 'metadata' || anything,
      folders: kind === 'metadata' ? [] : folder === null ? null : [folder],
    });
  }

  private async loadIgnoreRules(): Promise<void> {
    const ignoreConf = await readFile(join(this.workspacePath, 'ignore.conf'), 'utf8').catch(() => '');
    this.ignoreRules = parseIgnoreRules(ignoreConf);
  }
}

/** Own writes in progress, and the moment their last events should have arrived by. */
class OwnWrites {
  private running = 0;
  private quietUntil = 0;

  track(write: Promise<unknown>): void {
    this.running++;
    void write
      .catch(() => undefined)
      .finally(() => {
        this.running--;
        this.quietUntil = Date.now() + AFTER_OWN_WRITE_GRACE_MS;
      });
  }

  active(): boolean {
    return this.running > 0 || Date.now() < this.quietUntil;
  }
}
