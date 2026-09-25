import type { ReactNode } from 'react';
import styles from './PaneToolbar.module.css';

interface PaneToolbarProps {
  /** Left side: what the pane shows. */
  title: ReactNode;
  /** Right side: the pane's controls. */
  children?: ReactNode;
}

/** The slim bar on top of a content pane, like the diff viewer's. */
export function PaneToolbar({ title, children }: PaneToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.title}>{title}</div>
      {children}
    </div>
  );
}

/** Keeps related icon buttons of a toolbar tight together. */
export function PaneToolbarGroup({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}
