import type { ReactNode } from 'react';
import styles from './ListToolbar.module.css';

/** What sits over a list of files: its filter bar, then the review strip when there is one, each ruled off. */
export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}
