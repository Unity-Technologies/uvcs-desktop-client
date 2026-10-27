import type { ReactNode } from 'react';
import styles from './TargetDiff.module.css';

export interface DiffHeaderProps {
  /** What is compared: a changeset's summary, a branch, a range; nothing while it isn't known yet. */
  description?: ReactNode;
  /** At the header's end, whatever the body shows: a branch diff's "Whole branch | Changeset by changeset". */
  toolbar?: ReactNode;
}

/** What a diff compares, and the switches at its end: over the whole page, or over one changeset's diff in a branch's. */
export function DiffHeader({ description, toolbar }: DiffHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.description}>{description}</div>
      {toolbar}
    </header>
  );
}
