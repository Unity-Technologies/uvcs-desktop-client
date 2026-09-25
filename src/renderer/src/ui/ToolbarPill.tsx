import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './ToolbarPill.module.css';

interface ToolbarPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** What the pill is or does, e.g. "Branch". */
  label: ReactNode;
  /** Its value or state on the second line, e.g. "/main/task". */
  sub: ReactNode;
  /** Which line stands out: `sub` for pills that show a value (a branch) under a small caption. */
  emphasis?: 'label' | 'sub';
  trailing?: ReactNode;
}

/** A two-line toolbar button: a label over a line of state, so the button explains itself at a glance. */
export const ToolbarPill = forwardRef<HTMLButtonElement, ToolbarPillProps>(function ToolbarPill(
  { icon, label, sub, emphasis = 'label', trailing, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={[styles.pill, className].filter(Boolean).join(' ')} data-emphasis={emphasis} {...rest}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.stack}>
        <span className={styles.label}>{label}</span>
        <span className={styles.sub}>{sub}</span>
      </span>
      {trailing}
    </button>
  );
});
