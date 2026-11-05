import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './IssueTrackerPane.module.css';

/** A line that checks out, with a green check: a link read, a proof that the sign-in works. */
export function CheckedLine({ children }: { children: ReactNode }) {
  return (
    <p className={styles.checked}>
      <Check size={14} strokeWidth={2.5} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
