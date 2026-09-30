import type { ReactNode } from 'react';
import styles from './DetailsLink.module.css';

/** A value that takes you somewhere else in the app, e.g. the parent changeset. */
export function DetailsLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className={styles.link} onClick={onClick}>
      {children}
    </button>
  );
}
