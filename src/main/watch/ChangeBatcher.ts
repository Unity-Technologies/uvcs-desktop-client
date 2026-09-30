import { mergeChanges, type WorkspaceChange } from '@shared/domain/workspaceChange';

/**
 * Folds bursts of file system events into one batch: flushes once events stop for `quietMs`, and at the latest
 * `maxWaitMs` after the first one, so a long stream of writes (a build, an agent editing hundreds of files) still
 * refreshes regularly instead of never, or on every event.
 */
export class ChangeBatcher {
  private batch: WorkspaceChange | null = null;
  private quietTimer: NodeJS.Timeout | null = null;
  private maxWaitTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly onFlush: (batch: WorkspaceChange) => void,
    private readonly quietMs: number,
    private readonly maxWaitMs: number,
  ) {}

  add(change: WorkspaceChange): void {
    if (!this.batch) this.maxWaitTimer = setTimeout(() => this.flush(), this.maxWaitMs);
    this.batch = this.batch ? mergeChanges(this.batch, change) : change;
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = setTimeout(() => this.flush(), this.quietMs);
  }

  /** Drops the pending batch without reporting it. */
  cancel(): void {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
    this.quietTimer = null;
    this.maxWaitTimer = null;
    this.batch = null;
  }

  private flush(): void {
    const batch = this.batch;
    this.cancel();
    if (batch) this.onFlush(batch);
  }
}
