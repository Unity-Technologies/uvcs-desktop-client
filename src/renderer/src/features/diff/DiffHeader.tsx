import type { ReactNode } from 'react';
import styles from './TargetDiff.module.css';

export interface DiffHeaderProps {
  /** What is compared: a changeset's summary, a branch, a range; nothing while it isn't known yet. */
  description?: ReactNode;
  /** At the header's end, whatever the body shows: a shelve's actions, a review's Comments panel toggle. */
  toolbar?: ReactNode;
}

/** What a diff compares, and the switches at its end: over the whole page, or over one changeset's diff in a branch's. */
export function DiffHeader({ description, toolbar }: DiffHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.description}>{description}</div>
      {/* Its switches sit together, apart from the description. */}
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
    </header>
  );
}
