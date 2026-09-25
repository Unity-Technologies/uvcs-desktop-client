import type { ReactNode } from 'react';
import styles from './DiffViewerFrame.module.css';

interface DiffViewerFrameProps {
  /** Left of the toolbar, e.g. the file path and its status. */
  title?: ReactNode;
  /** Right of the toolbar: how to view the diff. */
  controls?: ReactNode;
  children?: ReactNode;
}

export function DiffViewerFrame({ title, controls, children }: DiffViewerFrameProps) {
  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.title}>{title}</div>
        {controls}
      </div>
      {children}
    </div>
  );
}

/** A cluster of icon buttons in the toolbar. */
export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}
