import { app } from 'electron';
import { quitStarted } from '../window/leaveRequests';

export interface QuittingDependencies {
  /** Whether an operation changing a workspace runs (`OperationTracker.writesRunning`), which quitting would stop partway. */
  writesRunning: () => boolean;
  /** Settles once none runs (`OperationTracker.writesFinished`). */
  writesFinished: () => Promise<void>;
  /** Asks whether to quit once the running operation finishes (`askToQuitWhenDone`); false to stay. */
  askToQuitWhenDone: () => Promise<boolean>;
  /** Whether any window is open: Windows and Linux quit as the last one closes. */
  hasWindows: () => boolean;
  /** Whether the app quits as its last window closes (Windows, Linux), rather than staying with none (macOS). */
  quitsWithLastWindow: boolean;
  /** Saves the windows open now, to open again at the next launch (`WorkspaceWindows.saveSession`), with their views or not. */
  saveSession: (options: { withViews: boolean }) => void;
  quit: () => void;
}

/**
 * What happens as the app quits, in one `before-quit` listener, so each step knows whether an earlier one held the quit
 * back:
 * - An operation changing a workspace (update, switch, checkin, merge…) holds it back: quitting would kill its `cm`
 *   partway. The user is asked to quit once it finishes, or to stay; with no window left to ask from (the last one was
 *   closed), the app quits once it finishes.
 * - The windows open are saved (`saveSession`), before they close, to open again at the next launch; on the views they
 *   show when restarting to install an update (`restartToInstall`). Where the app quits as its last window closes, that
 *   window is saved as it closes (`lastWindowClosing`); on macOS, quitting with none open saves none.
 * - The pages hear it (`quitStarted`), so one holding unsaved edits quits the app once it settles them.
 */
export class Quitting {
  /** Asking, or waiting for the operation to finish: another quit meanwhile asks nothing more. */
  private holding = false;
  /** Quitting to install an update (`restartToInstall`), which then starts the app again. */
  private restarting = false;
  /** The quit went on (`before-quit`, not held back): the windows closing now were saved already. */
  private quitting = false;

  constructor(private readonly dependencies: QuittingDependencies) {}

  /** Electron's `before-quit`. */
  beforeQuit(event: { preventDefault(): void }): void {
    if (this.holding || this.dependencies.writesRunning()) {
      event.preventDefault();
      if (!this.holding) void this.quitWhenWritesFinish();
      return;
    }
    if (this.dependencies.hasWindows()) this.dependencies.saveSession({ withViews: this.restarting });
    // With none left, the session stays as the last window closing saved it (Windows, Linux) or as `restartToInstall`
    // did (Squirrel.Mac closes the windows before `before-quit`); on macOS, quitting with every window closed saves none.
    else if (!this.restarting && !this.dependencies.quitsWithLastWindow) this.dependencies.saveSession({ withViews: false });
    this.quitting = true;
    quitStarted();
  }

  /** The last window is closing: where the app quits with it, it's saved now, while it's still open. */
  lastWindowClosing(): void {
    if (this.dependencies.quitsWithLastWindow && !this.quitting) this.dependencies.saveSession({ withViews: false });
  }

  /**
   * About to quit to install an update (`AppUpdates.install`, once no operation runs): the windows are saved with their
   * views now, as on macOS they close before the quit begins.
   */
  restartToInstall(): void {
    this.restarting = true;
    this.dependencies.saveSession({ withViews: true });
  }

  private async quitWhenWritesFinish(): Promise<void> {
    this.holding = true;
    try {
      if (this.dependencies.hasWindows() && !(await this.dependencies.askToQuitWhenDone())) return;
      await this.dependencies.writesFinished();
    } finally {
      this.holding = false;
    }
    this.dependencies.quit();
  }
}

/** Listens to the app's quit (`Quitting`). */
export function handleQuitting(quitting: Quitting): void {
  app.on('before-quit', (event) => quitting.beforeQuit(event));
}
