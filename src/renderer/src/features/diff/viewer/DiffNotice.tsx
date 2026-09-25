import type { ReactNode } from 'react';
import styles from './DiffNotice.module.css';

interface DiffNoticeProps {
  /** `attention` asks for a decision (the file changed on disk); `info` just tells (no content changes). */
  tone: 'attention' | 'info';
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

/** A line above a diff, about the file shown. */
export function DiffNotice({ tone, icon, children, action }: DiffNoticeProps) {
  return (
    <div className={styles.notice} data-tone={tone}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>{children}</span>
      {action}
    </div>
  );
}
