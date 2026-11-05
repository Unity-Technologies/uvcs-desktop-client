import type { ReactNode } from 'react';
import styles from './ItemTag.module.css';

/**
 * A few words an item's row adds about it, first among its extras: a merge. `compact` for a word or two that rides
 * beside the name ("+ meta"), as small as the status badges so it doesn't compete with it.
 */
export function ItemTag({ children, tip, compact = false }: { children: ReactNode; tip?: string; compact?: boolean }) {
  return (
    <span className={styles.tag} data-tip={tip} data-compact={compact || undefined}>
      {children}
    </span>
  );
}
