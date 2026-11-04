import type { ReactNode, Ref } from 'react';
import { classNames } from '../lib/classNames';
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

interface PaneToolbarGroupProps {
  children: ReactNode;
  /** Where the group sits, beyond keeping its buttons tight (a bar's end). */
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Keeps related icon buttons of a toolbar tight together. */
export function PaneToolbarGroup({ children, className, ref }: PaneToolbarGroupProps) {
  return (
    <div ref={ref} className={classNames(styles.group, className)}>
      {children}
    </div>
  );
}
