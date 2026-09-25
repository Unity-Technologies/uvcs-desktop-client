import { watch, type FSWatcher } from 'node:fs';

const DEBOUNCE_MS = 400;
const IGNORED_SEGMENT = /(^|[\\/])\.plastic([\\/]|$)/;

/**
 * Watches one workspace at a time and reports (debounced) changes on disk.
 * `pathsChanged` tells whether items were added, deleted or moved, rather than only edited.
 */
export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pathsChanged = false;

  constructor(private readonly onChanged: (workspacePath: string, pathsChanged: boolean) => void) {}

  watch(workspacePath: string): void {
    this.stop();
    this.watcher = watch(workspacePath, { recursive: true }, (event, fileName) => {
      if (fileName && IGNORED_SEGMENT.test(fileName)) return;
      // Node reports additions, deletions and moves as 'rename'; content edits as 'change'.
      if (event === 'rename') this.pathsChanged = true;
      this.scheduleNotification(workspacePath);
    });
    this.watcher.on('error', () => this.stop());
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.pathsChanged = false;
  }

  private scheduleNotification(workspacePath: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const pathsChanged = this.pathsChanged;
      this.pathsChanged = false;
      this.onChanged(workspacePath, pathsChanged);
    }, DEBOUNCE_MS);
  }
}
