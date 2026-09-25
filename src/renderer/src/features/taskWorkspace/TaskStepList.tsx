import { Check, Circle, X } from 'lucide-react';
import { Spinner } from '../../ui/Spinner';
import type { TaskStep, TaskStepState } from './setUpTaskWorkspace';
import styles from './TaskWorkspaceDialog.module.css';

interface TaskStepListProps {
  steps: TaskStep[];
  states: Partial<Record<TaskStep, TaskStepState>>;
  labels: Record<TaskStep, string>;
  /** The latest progress line of the running step. */
  detail: string | null;
}

/** The steps of setting up the workspace, each pending, running, done or failed. */
export function TaskStepList({ steps, states, labels, detail }: TaskStepListProps) {
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
              {state === 'running' && detail && <span className={styles.stepDetail}>{detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
