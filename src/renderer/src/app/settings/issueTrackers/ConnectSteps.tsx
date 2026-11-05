import { Check } from 'lucide-react';
import { connectSteps } from './trackerCardContent';
import styles from './IssueTrackerPane.module.css';

/** Link · Sign in · Connected, the current one marked (`connectSteps`): where the user is in connecting. */
export function ConnectSteps({ linkRead }: { linkRead: boolean }) {
  const steps = connectSteps(linkRead);
  return (
    <ol className={styles.steps} aria-label="Steps">
      {steps.map((step, index) => (
        <li key={step.label} className={styles.stepItem} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
          <span className={styles.stepMark} aria-hidden>
            {step.state === 'done' ? <Check size={10} strokeWidth={3} /> : index + 1}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}
