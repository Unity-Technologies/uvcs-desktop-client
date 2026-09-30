import type { ReactNode } from 'react';
import styles from './DetailsBadge.module.css';

type BadgeTone = 'accent' | 'success' | 'neutral' | 'warning';

interface DetailsBadgeProps {
  tone?: BadgeTone;
  tip?: string;
  /** Gives way when the row is full, its text (a `<span>` child) cut with an ellipsis, e.g. a long label name. */
  shrinks?: boolean;
  children: ReactNode;
}

/** A small status pill beside a details panel's kind, such as "Current" or "Hidden". */
export function DetailsBadge({ tone = 'neutral', tip, shrinks, children }: DetailsBadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone} data-tip={tip} data-shrinks={shrinks || undefined}>
      {children}
    </span>
  );
}
