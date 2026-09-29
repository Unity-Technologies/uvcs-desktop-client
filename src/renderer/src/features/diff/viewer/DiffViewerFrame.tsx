import type { ReactNode, Ref } from 'react';
import { PaneToolbar } from '../../../ui/PaneToolbar';
import styles from './DiffViewerFrame.module.css';

interface DiffViewerFrameProps {
  /** Left of the toolbar, e.g. the file path and its status. */
  title?: ReactNode;
  /** Right of the toolbar: how to view the diff. */
  controls?: ReactNode;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function DiffViewerFrame({ title, controls, children, ref }: DiffViewerFrameProps) {
  return (
    <div ref={ref} className={styles.viewer}>
      <PaneToolbar title={title}>{controls}</PaneToolbar>
      {children}
    </div>
  );
}
