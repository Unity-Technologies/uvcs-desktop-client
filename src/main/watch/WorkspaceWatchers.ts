import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceChange } from '@shared/events';
import { WorkspaceWatcher } from './WorkspaceWatcher';

/** What the registry needs from a watcher; tests pass a fake. */
export interface Watcher {
  readonly workspacePath: string;
  start(): WatchCoverage;
  covers(cwd: string): boolean;
  ignoreOwnWrite(write: Promise<unknown>, only?: 'changelists'): void;
  stop(): void;
}

type CreateWatcher = (workspacePath: string, onChanged: (change: WorkspaceChange) => void) => Watcher;
type ChangeListener = (viewers: number[], workspacePath: string, change: WorkspaceChange) => void;
type StopListener = (workspacePath: string) => void;

interface Entry {
  watcher: Watcher;
  coverage: WatchCoverage;
  viewers: Set<number>;
}

/**
 * One watcher per workspace shown in some window (a viewer, by id). A window watches one workspace at a time;
 * the watcher stops when no window shows its workspace anymore (`onStopped`).
 */
export class WorkspaceWatchers {
  private readonly byPath = new Map<string, Entry>();
  private readonly watchedBy = new Map<number, string>();

  constructor(
    private readonly onChanged: ChangeListener,
    private readonly onStopped: StopListener,
    private readonly createWatcher: CreateWatcher = (path, onChanged) => new WorkspaceWatcher(path, onChanged),
  ) {}

  /** The viewer now shows `workspacePath`: it stops getting changes of the workspace it showed before. */
  watch(viewer: number, workspacePath: string): WatchCoverage {
    const current = this.byPath.get(workspacePath);
    if (current && this.watchedBy.get(viewer) === workspacePath) return current.coverage;
    this.release(viewer);

    const entry = current ?? this.start(workspacePath);
    entry.viewers.add(viewer);
    this.watchedBy.set(viewer, workspacePath);
    return entry.coverage;
  }

  /** The viewer shows no workspace anymore (home screen, or closed). */
  release(viewer: number): void {
    const workspacePath = this.watchedBy.get(viewer);
    if (workspacePath === undefined) return;
    this.watchedBy.delete(viewer);
    const entry = this.byPath.get(workspacePath);
    entry?.viewers.delete(viewer);
    if (entry && entry.viewers.size === 0) {
      entry.watcher.stop();
      this.byPath.delete(workspacePath);
      this.onStopped(workspacePath);
    }
  }

  workspaceOf(viewer: number): string | undefined {
    return this.watchedBy.get(viewer);
  }

  /** Ignores what `write` changes (or only its changelist rewrites) in the workspace containing `cwd`, or in every watched one without it. */
  ignoreOwnWrite(write: Promise<unknown>, cwd?: string, only?: 'changelists'): void {
    for (const { watcher } of this.byPath.values()) {
      if (cwd === undefined || watcher.covers(cwd)) watcher.ignoreOwnWrite(write, only);
    }
  }

  private start(workspacePath: string): Entry {
    const viewers = new Set<number>();
    const watcher = this.createWatcher(workspacePath, (change) => this.onChanged([...viewers], workspacePath, change));
    const entry = { watcher, coverage: watcher.start(), viewers };
    this.byPath.set(workspacePath, entry);
    return entry;
  }
}
