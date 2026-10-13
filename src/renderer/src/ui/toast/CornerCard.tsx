import type { ReactNode } from 'react';
import styles from './CornerCard.module.css';

interface CornerCardProps {
  icon: ReactNode;
  title: ReactNode;
  /** At the end of the title's row: a percent, a button that puts the card off. */
  trailing?: ReactNode;
  /** `alert` for a decision that waits on the user; `status` for news. */
  role: 'alert' | 'status';
  /** Buttons, at the bottom right. */
  actions?: ReactNode;
  /** Under the title: a line of text, a progress bar. */
  children?: ReactNode;
}

/**
 * A card of the app's own that stacks with the toasts (`ToastHost`'s children) and stays until it's answered or done:
 * the update, the question about profile pictures.
 */
export function CornerCard({ icon, title, trailing, role, actions, children }: CornerCardProps) {
  return (
    <div className={styles.card} role={role}>
      <div className={styles.row}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.title}>{title}</span>
        {trailing}
      </div>
      {children}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

/** A line of text under a corner card's title. */
export function CornerCardText({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}
