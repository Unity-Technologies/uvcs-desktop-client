import type { ReactNode } from 'react';
import styles from './ViewHeader.module.css';

interface ViewHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Filters, search boxes and other controls shown next to the title. */
  children?: ReactNode;
  actions?: ReactNode;
}

export function ViewHeader({ title, subtitle, children, actions }: ViewHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      <div className={styles.controls}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}
