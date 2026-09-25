import type { ReactNode } from 'react';
import styles from './ToggleChip.module.css';

interface ToggleChipProps {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  icon?: ReactNode;
  children: ReactNode;
}

/** An on/off filter such as "Mine" or "Show hidden". */
export function ToggleChip({ pressed, onChange, icon, children }: ToggleChipProps) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={() => onChange(!pressed)}>
      {icon}
      {children}
    </button>
  );
}
