import { watch, type FSWatcher } from 'node:fs';

const DEBOUNCE_MS = 400;
const IGNORED_SEGMENT = /(^|[\\/])\.plastic([\\/]|$)/;

/** Watches one workspace at a time and reports (debounced) changes on disk. */
export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(private readonly onChanged: (workspacePath: string) => void) {}

  watch(workspacePath: string): void {
    this.stop();
    this.watcher = watch(workspacePath, { recursive: true }, (_event, fileName) => {
      if (fileName && IGNORED_SEGMENT.test(fileName)) return;
      this.scheduleNotification(workspacePath);
    });
    this.watcher.on('error', () => this.stop());
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private scheduleNotification(workspacePath: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.onChanged(workspacePath), DEBOUNCE_MS);
  }
}
