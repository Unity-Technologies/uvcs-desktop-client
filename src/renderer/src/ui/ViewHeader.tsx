import type { ReactNode } from 'react';
import { formatCount } from '../lib/text';
import styles from './ViewHeader.module.css';

interface ViewHeaderProps {
  title: string;
  /** How many of what the title names are listed, next to it; every list view shows its count this way. */
  count?: number;
  /** Short context next to the title (and its count), e.g. a path. */
  subtitle?: ReactNode;
  /** Search boxes and filters, shown on their own row under the title. */
  children?: ReactNode;
  /** Buttons at the right of the title; put the view's primary action last. */
  actions?: ReactNode;
  /** Sits in the window's title area (no top bar above it), so its empty space moves the window. */
  inTitleBar?: boolean;
}

/**
 * The header every view shares: title and actions on the first row, filters on the second.
 * Keeping the same structure everywhere makes each screen predictable at a glance.
 */
export function ViewHeader({ title, count, subtitle, children, actions, inTitleBar }: ViewHeaderProps) {
  return (
    <header className={styles.header} data-title-bar={inTitleBar} data-drag-region={inTitleBar || undefined}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {count !== undefined && <div className={styles.subtitle}>{formatCount(count)}</div>}
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        <div className={styles.actions}>{actions}</div>
      </div>
      {children && <div className={styles.toolbar}>{children}</div>}
    </header>
  );
}
