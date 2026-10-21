import { MEASURED_FROM, WRAPPING_UP_STAGES, type OperationProgress } from '@shared/domain/operation';

/**
 * What the app's icon shows of the operations changing a workspace (the Dock on macOS, the taskbar button on Windows,
 * the launcher on Linux): nothing, an operation that can't tell yet how far along it is, how far along it is, or one
 * that failed while the user wasn't looking.
 */
export type IconProgress = { mode: 'none' } | { mode: 'unmeasured' } | { mode: 'measured'; value: number } | { mode: 'failed' };

export const NO_PROGRESS: IconProgress = { mode: 'none' };

export const UNMEASURED: IconProgress = { mode: 'unmeasured' };

/**
 * What one running operation shows after a report, given what it showed before (`UNMEASURED` at its start): how far
 * along the whole operation is, the steps before the current one done (a switch with changes shelves, undoes,
 * switches and brings them back). It never goes back: a new step starting from nothing, or a stage that measures
 * nothing between two that do, would empty a bar the user saw filling.
 */
export function operationIconProgress(progress: OperationProgress, previous: IconProgress): IconProgress {
  const current = wholeOperationProgress(progress);
  if (previous.mode !== 'measured') return current;
  return current.mode === 'measured' && current.value > previous.value ? current : previous;
}

function wholeOperationProgress(progress: OperationProgress): IconProgress {
  const { index, count } = progress.step ?? { index: 1, count: 1 };
  // Wrapping up after the measured work (a checkin confirming), all of it is done.
  const stepDone = progress.fraction ?? (WRAPPING_UP_STAGES.has(progress.stage) ? 1 : null);
  if (stepDone === null && index === 1) return UNMEASURED;
  const value = Math.min((index - 1 + (stepDone ?? 0)) / count, 1);
  return value < MEASURED_FROM ? UNMEASURED : { mode: 'measured', value };
}

/**
 * What one icon shows of several running operations: how far along they are together, an operation not measured yet
 * counting as none done; unmeasured while none is measured. A failure shows only once nothing runs.
 */
export function combinedIconProgress(running: readonly IconProgress[], failed: boolean): IconProgress {
  if (running.length === 0) return failed ? { mode: 'failed' } : NO_PROGRESS;
  if (!running.some((progress) => progress.mode === 'measured')) return { mode: 'unmeasured' };
  const done = running.reduce((sum, progress) => sum + (progress.mode === 'measured' ? progress.value : 0), 0);
  return { mode: 'measured', value: done / running.length };
}

/**
 * Whether the icon belongs to the app rather than to each window. Windows gives every window its own taskbar button;
 * the Dock and Linux's launcher (the Unity launcher API Electron uses) have one icon for the whole app, which every
 * window's `setProgressBar` sets.
 */
export function iconIsTheApp(platform: NodeJS.Platform): boolean {
  return platform !== 'win32';
}

/** The arguments of Electron's `BrowserWindow.setProgressBar` that draw `progress`. */
export interface ProgressBarCall {
  value: number;
  mode?: 'normal' | 'indeterminate' | 'error';
}

const HIDDEN: ProgressBarCall = { value: -1 };

/**
 * How each OS draws it. Only Windows has a pulse for work not measured yet and a red bar for a failure. The Dock
 * draws a value above 1 (Electron's indeterminate) as a full bar, which reads as done, and Linux's launcher has no
 * such state: there, an operation shows once it can tell how far along it is, and a failure shows nothing.
 */
export function progressBarCall(progress: IconProgress, platform: NodeJS.Platform): ProgressBarCall {
  const windows = platform === 'win32';
  switch (progress.mode) {
    case 'none':
      return HIDDEN;
    case 'unmeasured':
      return windows ? { value: 1, mode: 'indeterminate' } : HIDDEN;
    case 'measured':
      return windows ? { value: progress.value, mode: 'normal' } : { value: progress.value };
    case 'failed':
      return windows ? { value: 1, mode: 'error' } : HIDDEN;
  }
}
