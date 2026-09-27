import { AsyncResource } from 'node:async_hooks';
import type { CommandProgress, OperationProgress, ProgressStep } from '@shared/domain/operation';
import type { ProgressReader } from '../cm/progress/progressReader';
import { ProgressThrottle } from './ProgressThrottle';

export interface OperationContext {
  signal: AbortSignal;
  /** What the operation does, in the app's words, while no command reports it: "Writing resolved files", with how many of how many items when it counts them. */
  reportProgress: (activity: string, count?: { current: number; total: number }) => void;
  /** Starts a step of an operation made of several commands (shelve, undo, switch, bring the changes back). */
  beginStep: (label: string, index: number, count: number) => void;
  /** An `onOutputLine` that reads a command's progress with `reader` and reports it. */
  progressOf: (reader: ProgressReader) => (line: string) => void;
}

type ProgressListener = (operationId: string, progress: OperationProgress) => void;
type StartListener = (finished: Promise<unknown>) => void;

/** Tracks long-running operations so they can report progress and be cancelled from the UI. */
export class OperationTracker {
  private readonly running = new Map<string, AbortController>();

  constructor(
    private readonly onProgress: ProgressListener,
    private readonly onStarted: StartListener,
  ) {}

  /** Runs an operation that changes the workspace (update, switch, checkin…). */
  run<T>(operationId: string, work: (context: OperationContext) => Promise<T>): Promise<T> {
    return this.track(operationId, work, true);
  }

  /** Runs a slow read that the UI may cancel; the workspace watcher keeps reporting changes meanwhile. */
  read<T>(operationId: string, work: (context: OperationContext) => Promise<T>): Promise<T> {
    return this.track(operationId, work, false);
  }

  private async track<T>(operationId: string, work: (context: OperationContext) => Promise<T>, writes: boolean): Promise<T> {
    const controller = new AbortController();
    this.running.set(operationId, controller);
    // Progress comes from process output events: bound to the caller's context, it reaches the window that started it.
    const throttle = new ProgressThrottle<OperationProgress>(AsyncResource.bind((progress) => this.onProgress(operationId, progress)));
    let step: ProgressStep | undefined;
    let last: OperationProgress | null = null;
    const report = (command: CommandProgress): void => {
      const progress: OperationProgress = step ? { ...command, step } : command;
      throttle.push(progress, !last || last.stageLabel !== progress.stageLabel || last.step !== progress.step);
      last = progress;
    };

    try {
      const finished = work({
        signal: controller.signal,
        reportProgress: (activity, count) => report(working(activity, count)),
        beginStep: (label, index, count) => {
          step = { label, index, count };
          report(working(label));
        },
        progressOf: (reader) => {
          let command: CommandProgress | null = null;
          return (line) => {
            const next = reader(command, line);
            if (next === command || !next) return;
            command = next;
            report(next);
          };
        },
      });
      if (writes) this.onStarted(finished);
      return await finished;
    } finally {
      // The last numbers ("530 of 530 files") are what the completion message sums up.
      throttle.flush();
      this.running.delete(operationId);
    }
  }

  cancel(operationId: string): void {
    this.running.get(operationId)?.abort();
  }
}

function working(stageLabel: string, count?: { current: number; total: number }): CommandProgress {
  if (!count || count.total === 0) return { stage: 'working', stageLabel, fraction: null };
  return { stage: 'working', stageLabel, ...count, fraction: count.current / count.total };
}
