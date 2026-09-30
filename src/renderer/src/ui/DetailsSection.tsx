import type { ReactNode } from 'react';
import styles from './DetailsSection.module.css';

interface DetailsSectionProps {
  title: string;
  /** A small control at the right of the title, e.g. "Add". */
  action?: ReactNode;
  children: ReactNode;
}

/** A titled card inside the details panel. */
export function DetailsSection({ title, action, children }: DetailsSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {action}
      </div>
      <div className={styles.card}>{children}</div>
    </section>
  );
}

/** A friendly message where a section or the changes pane has nothing to list, e.g. "No attributes yet". */
export function DetailsEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.placeholder}>{children}</p>;
}

/** Placeholder rows while a section or the changes pane loads. */
export function DetailsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={styles.skeletonRow} />
      ))}
    </div>
  );
}
