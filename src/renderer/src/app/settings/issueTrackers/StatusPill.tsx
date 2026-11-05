import type { TrackerStatus } from './trackerCardContent';
import styles from './IssueTrackerPane.module.css';

/** How a connection stands (`trackerStatus`): a dot and a word, in its tone's colors. */
export function StatusPill({ status }: { status: TrackerStatus }) {
  return (
    <span className={styles.pill} data-tone={status.tone} role="status">
      {status.label}
    </span>
  );
}
