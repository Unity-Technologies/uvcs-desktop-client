import type { ReactNode } from 'react';
import styles from './TargetDiff.module.css';

interface DiffFrameProps {
  /** What is compared: a changeset's summary, a branch, a range; nothing while it isn't known yet. */
  description?: ReactNode;
  /** At the header's end, whatever the body shows: a branch diff's "Whole branch | Changeset by changeset". */
  toolbar?: ReactNode;
  children: ReactNode;
}

/** A diff's header over its body, the same while what it compares loads, when there is nothing, and once it's in. */
export function DiffFrame({ description, toolbar, children }: DiffFrameProps) {
  return (
    <div className={styles.diff}>
      <header className={styles.header}>
        <div className={styles.description}>{description}</div>
        {toolbar}
      </header>
      {children}
    </div>
  );
}
