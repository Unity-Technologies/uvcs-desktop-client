import { Check, Circle, X } from 'lucide-react';
import { describeProgress } from '../../app/operations/describeProgress';
import type { ProgressBarState } from '../../app/operations/progressBar';
import { ProgressTrack } from '../../app/operations/ProgressTrack';
import { Spinner } from '../../ui/Spinner';
import type { TaskStep, TaskStepState } from './setUpTaskWorkspace';
import styles from './TaskWorkspaceDialog.module.css';

interface TaskStepListProps {
  steps: TaskStep[];
  states: Partial<Record<TaskStep, TaskStepState>>;
  labels: Record<TaskStep, string>;
  /** The progress of the running step, when it reports any (the switch does). */
  progress: TaskStepProgress | null;
}

export interface TaskStepProgress {
  text: ReturnType<typeof describeProgress>;
  bar: ProgressBarState;
}

/** The steps of setting up the workspace, each pending, running, done or failed. */
export function TaskStepList({ steps, states, labels, progress }: TaskStepListProps) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => {
        const state = states[step];
        return (
          <li key={step} className={styles.step} data-state={state ?? 'pending'}>
            <span className={styles.stepIcon}>
              {state === 'running' ? <Spinner size={12} /> : state === 'done' ? <Check size={13} /> : state === 'failed' ? <X size={13} /> : <Circle size={8} />}
            </span>
            <span className={styles.stepText}>
              <span>{labels[step]}</span>
              {state === 'running' && progress && (
                <>
                  <span className={styles.stepDetail}>
                    <span className={styles.stepStage}>{progress.text.stage}</span>
                    <span className={styles.stepPercent}>{progress.text.percent}</span>
                  </span>
                  <ProgressTrack className={styles.stepTrack} bar={progress.bar} />
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
