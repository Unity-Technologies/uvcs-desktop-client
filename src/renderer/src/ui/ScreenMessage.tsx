import type { ReactNode } from 'react';
import styles from './ScreenMessage.module.css';

interface ScreenMessageProps {
  icon: ReactNode;
  /** `warning` tints the icon for problems the user has to fix. */
  tone?: 'neutral' | 'warning';
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** Quieter content under the actions, e.g. a "Look again" link or raw output. */
  footer?: ReactNode;
  /**
   * Shown under the window's top bar, which drags the window, rather than in its place: the message's own band for
   * dragging is left out.
   */
  underTopBar?: boolean;
}

/** A whole-window message that replaces the app while something blocks it, with the ways forward. */
export function ScreenMessage({ icon, tone = 'neutral', title, children, actions, footer, underTopBar = false }: ScreenMessageProps) {
  return (
    <div className={styles.screen}>
      {!underTopBar && <div className={styles.dragRegion} />}
      <div className={styles.card}>
        <div className={styles.icon} data-tone={tone}>
          {icon}
        </div>
        <h1 className={styles.title}>{title}</h1>
        {children && <div className={styles.body}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
