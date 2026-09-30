import type { CommandProgress, OperationProgress, ProgressStep } from '@shared/domain/operation';
import type { OperationContext } from './OperationTracker';
import { ProgressThrottle } from './ProgressThrottle';

/**
 * One operation's progress as it reports it (`OperationContext`): each command's, or the app's own words, with the
 * step the operation is at. Reports are throttled; a new stage or step goes at once.
 */
export class ProgressReport {
  private readonly throttle: ProgressThrottle<OperationProgress>;
  private step: ProgressStep | undefined;
  private last: OperationProgress | null = null;

  constructor(emit: (progress: OperationProgress) => void) {
    this.throttle = new ProgressThrottle(emit);
  }

  /** What the operation reports its progress through. */
  context(signal: AbortSignal): OperationContext {
    return {
      signal,
      reportProgress: (activity, count) => this.report(working(activity, count)),
      beginStep: (label, index, count) => {
        this.step = { label, index, count };
        this.report(working(label));
      },
      progressOf: (reader) => {
        let command: CommandProgress | null = null;
        return (line) => {
          const next = reader(command, line);
          if (next === command || !next) return;
          command = next;
          this.report(next);
        };
      },
    };
  }

  /** Sends what's pending: the last numbers ("530 of 530 files") are what the completion message sums up. */
  flush(): void {
    this.throttle.flush();
  }

  private report(command: CommandProgress): void {
    const progress: OperationProgress = this.step ? { ...command, step: this.step } : command;
    const isNewStage = !this.last || this.last.stageLabel !== progress.stageLabel || this.last.step !== progress.step;
    this.throttle.push(progress, isNewStage);
    this.last = progress;
  }
}

function working(stageLabel: string, count?: { current: number; total: number }): CommandProgress {
  if (!count || count.total === 0) return { stage: 'working', stageLabel, fraction: null };
  return { stage: 'working', stageLabel, ...count, fraction: count.current / count.total };
}
