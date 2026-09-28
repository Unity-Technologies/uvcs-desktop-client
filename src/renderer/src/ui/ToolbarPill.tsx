import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './ToolbarPill.module.css';

interface ToolbarPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** The value it shows, e.g. the branch name. */
  label: ReactNode;
  /** A muted line under it, e.g. the branch comment; the label centers alone without it. */
  sub?: ReactNode;
  trailing?: ReactNode;
  /**
   * The widest the two lines get: the pill is as wide as the wider of them up to this, so a label fitted to the same
   * width (`PathLabel`'s `maxWidth`) never trims more than the pill needs, nor leaves room after it.
   */
  textMaxWidth?: number;
}

/** A bordered two-line toolbar field: a value over a muted line that describes it, like a select showing its choice. */
export const ToolbarPill = forwardRef<HTMLButtonElement, ToolbarPillProps>(function ToolbarPill(
  { icon, label, sub, trailing, textMaxWidth, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={[styles.pill, className].filter(Boolean).join(' ')} {...rest}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.stack} style={{ maxWidth: textMaxWidth }}>
        <span className={styles.label}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {trailing}
    </button>
  );
});
