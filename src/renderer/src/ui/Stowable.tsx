import type { ReactNode } from 'react';
import styles from './Stowable.module.css';

/**
 * Its children, laid out as if it weren't there; while `stowed`, out of sight but still mounted, so they come back as
 * they were left and read nothing again (a sidebar's counts, a header's filters). An expanded diff stows what isn't it.
 */
export function Stowable({ stowed, children }: { stowed: boolean; children: ReactNode }) {
  return (
    <div className={styles.stowable} hidden={stowed}>
      {children}
    </div>
  );
}
