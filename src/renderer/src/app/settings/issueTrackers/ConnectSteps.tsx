import { Check } from 'lucide-react';
import { connectSteps, type ConnectStage } from './trackerCardContent';
import styles from './IssueTrackerPane.module.css';

/** Tracker · Link · Sign in, the current one marked (`connectSteps`): where the user is in connecting. */
export function ConnectSteps({ stage, trackerName, signedIn = false }: { stage: ConnectStage; trackerName?: string; signedIn?: boolean }) {
  const steps = connectSteps(stage, trackerName, { signedIn });
  return (
    <ol className={styles.steps} aria-label="Steps">
      {steps.map((step, index) => (
        <li key={index} className={styles.stepItem} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
          <span className={styles.stepMark} aria-hidden>
            {step.state === 'done' ? <Check size={10} strokeWidth={3} /> : index + 1}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}
