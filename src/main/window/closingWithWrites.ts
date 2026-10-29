export interface ClosingWithWritesDependencies {
  /** The app is quitting (`Quitting.started`): its windows close with it, and it waited for every operation first. */
  quitting: () => boolean;
  /** Whether an operation changing a workspace that the window (or a page window it owns) started runs (`WindowWrites`). */
  writesRunningIn: (windowId: number) => boolean;
  /** Settles once none runs, the windows' operations as of each round (`WindowWrites.finishedIn`). */
  writesFinishedIn: (windowId: number) => Promise<void>;
  /** Asks, over the window, whether to close it once its operation finishes (`askToCloseWhenDone`); false to keep it. */
  askToCloseWhenDone: (windowId: number) => Promise<boolean>;
  /** The window stays open: what took it as closing (the app's icon, `AppIconProgress.windowKept`) takes it back. */
  kept: (windowId: number) => void;
  close: (windowId: number) => void;
}

/**
 * A window running an operation that changes its workspace (update, switch, checkin, merge, sync…) holds its own
 * close back, on every OS: closing it would hide the operation while it still runs, and, where the app quits with its
 * last window (Windows, Linux), leave it running with no window at all. The user is asked to close the window once
 * the operation finishes, or to keep it. Quitting asks on its own (`Quitting`) and goes on only once no operation
 * runs, so once it began, closes aren't held: the windows it closes were not asked about, and one waiting meanwhile
 * closes (or is gone) when its operation, finished by then, settles.
 */
export class ClosingWithWrites {
  /** Windows asking, or waiting for their operation to finish: closing one again meanwhile asks nothing more. */
  private readonly holding = new Set<number>();

  /** Windows the app closes once their operation finishes (`closeLeftBehind`). */
  private readonly leaving = new Set<number>();

  /** The window the app is closing this very turn (`closeLeftBehind`), whose close `closeRequested` lets be. */
  private closingNow: number | undefined;

  constructor(private readonly dependencies: ClosingWithWritesDependencies) {}

  /** The window's `close`, before any other listener sees it (`WorkspaceWindows`' `onCloseRequested`). */
  closeRequested(windowId: number, event: { preventDefault(): void }): void {
    // A quit isn't held back: it waited for the operations, and a window's question mustn't veto the app's own close.
    if (this.dependencies.quitting() || this.closingNow === windowId) return;
    if (!this.holding.has(windowId) && !this.dependencies.writesRunningIn(windowId)) return;
    event.preventDefault();
    this.dependencies.kept(windowId);
    if (!this.holding.has(windowId)) void this.closeWhenWritesFinish(windowId);
  }

  /**
   * The app closes a window itself (a page window whose workspace window left its workspace): nothing is asked, as the
   * user didn't close it, but it stays open while an operation it started runs, then closes.
   */
  closeLeftBehind(windowId: number): void {
    if (this.leaving.has(windowId)) return;
    this.leaving.add(windowId);
    void this.closeOnceIdle(windowId);
  }

  /** Waits for every round of operations (one may start as another ends), then closes in the same turn, so none slips in. */
  private async closeOnceIdle(windowId: number): Promise<void> {
    while (this.dependencies.writesRunningIn(windowId)) await this.dependencies.writesFinishedIn(windowId);
    this.closingNow = windowId;
    try {
      this.dependencies.close(windowId);
    } finally {
      this.closingNow = undefined;
      this.leaving.delete(windowId);
    }
  }

  private async closeWhenWritesFinish(windowId: number): Promise<void> {
    this.holding.add(windowId);
    try {
      if (!(await this.dependencies.askToCloseWhenDone(windowId))) return;
      await this.dependencies.writesFinishedIn(windowId);
    } finally {
      this.holding.delete(windowId);
    }
    this.dependencies.close(windowId);
  }
}
