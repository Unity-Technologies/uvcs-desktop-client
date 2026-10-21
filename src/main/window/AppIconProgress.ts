import type { OperationProgress } from '@shared/domain/operation';
import { combinedIconProgress, iconIsTheApp, NO_PROGRESS, operationIconProgress, progressBarCall, UNMEASURED, type IconProgress, type ProgressBarCall } from './iconProgress';

/** The app's windows as the icon needs them, by `BrowserWindow.id`. */
export interface IconWindows {
  /** The windows open now. */
  ids(): number[];
  isFocused(windowId: number): boolean;
  setProgressBar(windowId: number, call: ProgressBarCall): void;
}

interface RunningOperation {
  windowId: number;
  /** What it shows on the icon, from its reports so far. */
  icon: IconProgress;
}

/**
 * Shows the operations changing a workspace (`OperationTracker.run`: a checkin, an update, a switch, a merge…) on the
 * app's icon, so their progress shows while the app is in the background. A failure shows on Windows until the user
 * comes back to its window.
 */
export class AppIconProgress {
  private readonly running = new Map<string, RunningOperation>();
  /** Windows where an operation failed while the user wasn't looking. */
  private readonly unseenFailures = new Set<number>();
  /** Windows closing, which no longer set the icon: one held back (`windowKept`) goes on setting it. */
  private readonly closing = new Set<number>();
  /** What each window last set, so a report that changes nothing on the icon sets nothing. */
  private readonly shown = new Map<number, string>();

  constructor(
    private readonly windows: IconWindows,
    private readonly platform: NodeJS.Platform,
  ) {}

  /** An operation started from the window; `signal` tells a cancelled one from one that failed. */
  started(operationId: string, windowId: number, finished: Promise<unknown>, signal: AbortSignal): void {
    this.running.set(operationId, { windowId, icon: UNMEASURED });
    this.unseenFailures.delete(windowId);
    this.show();
    finished.then(
      () => this.finished(operationId, false),
      () => this.finished(operationId, !signal.aborted),
    );
  }

  reported(operationId: string, progress: OperationProgress): void {
    const operation = this.running.get(operationId);
    if (!operation) return;
    operation.icon = operationIconProgress(progress, operation.icon);
    this.show();
  }

  windowOpened(): void {
    this.show();
  }

  windowFocused(windowId: number): void {
    if (this.unseenFailures.delete(windowId)) this.show();
  }

  /**
   * The window began closing. The Dock keeps a bar its window set after that window is gone, so the last window clears
   * the app's icon now, while it still can; its operations go on showing in any window opened later.
   */
  windowClosing(windowId: number): void {
    this.closing.add(windowId);
    this.shown.delete(windowId);
    const othersShow = this.windows.ids().some((id) => id !== windowId && !this.closing.has(id));
    if (!iconIsTheApp(this.platform) || !othersShow) this.windows.setProgressBar(windowId, progressBarCall(NO_PROGRESS, this.platform));
    this.show();
  }

  /** The window's page held its close back (unsaved edits): the window stays and sets the icon again. */
  windowKept(windowId: number): void {
    this.closing.delete(windowId);
    this.show();
  }

  windowClosed(windowId: number): void {
    this.closing.delete(windowId);
    this.unseenFailures.delete(windowId);
    this.shown.delete(windowId);
    this.show();
  }

  private finished(operationId: string, failed: boolean): void {
    const operation = this.running.get(operationId);
    if (!operation) return;
    this.running.delete(operationId);
    if (failed && !this.windows.isFocused(operation.windowId)) this.unseenFailures.add(operation.windowId);
    this.show();
  }

  private show(): void {
    for (const windowId of this.windows.ids()) {
      if (this.closing.has(windowId)) continue;
      const call = progressBarCall(this.progressOf(windowId), this.platform);
      const key = `${call.value} ${call.mode}`;
      if (this.shown.get(windowId) === key) continue;
      this.shown.set(windowId, key);
      this.windows.setProgressBar(windowId, call);
    }
  }

  /** Every operation on the app's own icon (the Dock, Linux's launcher); each window's own on Windows. */
  private progressOf(windowId: number): IconProgress {
    const wholeApp = iconIsTheApp(this.platform);
    const running = [...this.running.values()].filter((operation) => wholeApp || operation.windowId === windowId);
    const failed = wholeApp ? this.unseenFailures.size > 0 : this.unseenFailures.has(windowId);
    return combinedIconProgress(
      running.map((operation) => operation.icon),
      failed,
    );
  }
}
