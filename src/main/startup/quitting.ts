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
  /** Saves the windows open now, to open again at the next launch (`WorkspaceWindows.saveSession`). */
  saveSession: () => void;
  quit: () => void;
}

/**
 * What happens as the app quits, in one `before-quit` listener, so each step knows whether an earlier one held the quit
 * back:
 * - An operation changing a workspace (update, switch, checkin, merge…) holds it back: quitting would kill its `cm`
 *   partway. The user is asked to quit once it finishes, or to stay; with no window left to ask from (the last one was
 *   closed), the app quits once it finishes.
 * - The windows open are saved (`saveSession`), before they close, to open again at the next launch.
 * - The pages hear it (`quitStarted`), so one holding unsaved edits quits the app once it settles them.
 */
export class Quitting {
  /** Asking, or waiting for the operation to finish: another quit meanwhile asks nothing more. */
  private holding = false;

  constructor(private readonly dependencies: QuittingDependencies) {}

  /** Electron's `before-quit`. */
  beforeQuit(event: { preventDefault(): void }): void {
    if (this.holding || this.dependencies.writesRunning()) {
      event.preventDefault();
      if (!this.holding) void this.quitWhenWritesFinish();
      return;
    }
    this.dependencies.saveSession();
    quitStarted();
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
