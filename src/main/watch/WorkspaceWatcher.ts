import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceChange } from '@shared/events';
import { ChangeBatcher } from './ChangeBatcher';
import { classifyChange } from './classifyChange';
import { NO_IGNORE_RULES, parseIgnoreRules, type IgnoreRules } from './ignoreRules';

const QUIET_MS = 300;
const MAX_WAIT_MS = 2000;
/** File system events arrive a little after the write that caused them. */
const AFTER_OWN_WRITE_GRACE_MS = 250;
/** One native stream for the whole tree (FSEvents, ReadDirectoryChangesW). On Linux, Node would add an inotify watch per directory, including ignored ones. */
const RECURSIVE_WATCH_PLATFORMS = new Set<NodeJS.Platform>(['darwin', 'win32']);

/**
 * Watches the open workspace and reports what changed, in coalesced batches: file edits (pending changes) apart
 * from `.plastic` state rewrites (checkin, update, switch... by any tool). Changes caused by the app's own writes
 * are dropped, because the app refreshes its views after them anyway.
 */
export class WorkspaceWatcher {
  private workspacePath: string | null = null;
  private watchers: FSWatcher[] = [];
  private ignoreRules: IgnoreRules = NO_IGNORE_RULES;
  private ownWritesRunning = 0;
  private quietUntil = 0;
  private readonly batcher: ChangeBatcher;

  constructor(onChanged: (workspacePath: string, change: WorkspaceChange) => void) {
    this.batcher = new ChangeBatcher((change) => this.workspacePath && onChanged(this.workspacePath, change), QUIET_MS, MAX_WAIT_MS);
  }

  watch(workspacePath: string): WatchCoverage {
    this.stop();
    this.workspacePath = workspacePath;
    void this.loadIgnoreRules(workspacePath);
    if (RECURSIVE_WATCH_PLATFORMS.has(process.platform) && this.tryWatch(workspacePath, true)) return 'full';
    // Without recursion, edits in subfolders go unnoticed; the root and `.plastic` still report checkins, switches...
    this.tryWatch(workspacePath, false);
    this.tryWatch(join(workspacePath, '.plastic'), false);
    return 'partial';
  }

  /** Ignores changes in the watched workspace until `write` settles; `cwd` limits it to writes in that workspace. */
  ignoreOwnWrite(write: Promise<unknown>, cwd?: string): void {
    if (!this.workspacePath || (cwd && !isInside(cwd, this.workspacePath))) return;
    this.ownWritesRunning++;
    this.batcher.cancel();
    void write
      .catch(() => undefined)
      .finally(() => {
        this.ownWritesRunning--;
        this.quietUntil = Date.now() + AFTER_OWN_WRITE_GRACE_MS;
      });
  }

  stop(): void {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
    this.batcher.cancel();
    this.workspacePath = null;
    this.ignoreRules = NO_IGNORE_RULES;
  }

  private tryWatch(path: string, recursive: boolean): boolean {
    const root = this.workspacePath;
    if (!root) return false;
    try {
      const watcher = watch(path, { recursive }, (event, fileName) => {
        const relativePath = fileName === null ? undefined : relative(root, join(path, fileName));
        this.onEvent(root, event, relativePath);
      });
      watcher.on('error', () => watcher.close());
      this.watchers.push(watcher);
      return true;
    } catch {
      return false;
    }
  }

  private onEvent(root: string, event: string, relativePath: string | undefined): void {
    if (root !== this.workspacePath) return;
    if (relativePath === 'ignore.conf') void this.loadIgnoreRules(root);
    const kind = classifyChange(relativePath, this.ignoreRules);
    if (!kind || this.ownWritesRunning > 0 || Date.now() < this.quietUntil) return;
    this.batcher.add({
      content: kind === 'content',
      // Node reports additions, deletions and moves as 'rename'; content edits as 'change'.
      pathsChanged: kind === 'content' && event === 'rename',
      metadata: kind === 'metadata',
    });
  }

  private async loadIgnoreRules(workspacePath: string): Promise<void> {
    const ignoreConf = await readFile(join(workspacePath, 'ignore.conf'), 'utf8').catch(() => '');
    if (this.workspacePath === workspacePath) this.ignoreRules = parseIgnoreRules(ignoreConf);
  }
}

function isInside(path: string, directory: string): boolean {
  return path === directory || path.startsWith(directory.endsWith(sep) ? directory : directory + sep);
}
