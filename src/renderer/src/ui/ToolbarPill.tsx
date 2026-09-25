import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './ToolbarPill.module.css';

interface ToolbarPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** The value it shows, e.g. the branch name. */
  label: ReactNode;
  /** A muted line under it, e.g. the branch comment; the label centers alone without it. */
  sub?: ReactNode;
  trailing?: ReactNode;
}

/** A bordered two-line toolbar field: a value over a muted line that describes it, like a select showing its choice. */
export const ToolbarPill = forwardRef<HTMLButtonElement, ToolbarPillProps>(function ToolbarPill(
  { icon, label, sub, trailing, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={[styles.pill, className].filter(Boolean).join(' ')} {...rest}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.stack}>
        <span className={styles.label}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {trailing}
    </button>
  );
});
