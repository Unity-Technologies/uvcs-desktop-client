/** File system events arrive a little after the write that caused them. */
const AFTER_OWN_WRITE_GRACE_MS = 250;

/**
 * The app's own writes to a workspace in progress, and the moment their last file system events should have arrived
 * by: until then, what the watcher sees is theirs.
 */
export class OwnWrites {
  private running = 0;
  private quietUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** A write started; it counts until it settles, failed or not, and for a grace period after. */
  track(write: Promise<unknown>): void {
    this.running++;
    void write
      .catch(() => undefined)
      .finally(() => {
        this.running--;
        this.quietUntil = this.now() + AFTER_OWN_WRITE_GRACE_MS;
      });
  }

  active(): boolean {
    return this.running > 0 || this.now() < this.quietUntil;
  }
}
