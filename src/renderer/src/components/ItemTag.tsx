import type { ReactNode } from 'react';
import styles from './ItemTag.module.css';

/** A few words an item's row adds about it, first among its extras: "modified" for a moved file that changed, a merge. */
export function ItemTag({ children, tip }: { children: ReactNode; tip?: string }) {
  return (
    <span className={styles.tag} data-tip={tip}>
      {children}
    </span>
  );
}
