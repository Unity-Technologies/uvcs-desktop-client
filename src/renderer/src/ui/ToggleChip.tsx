import { ChevronDown } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
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

interface MenuChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  /** Highlights the chip when its filter narrows the list (e.g. anything but "Any time"). */
  active?: boolean;
}

/** A filter that opens a menu of choices, e.g. "Last month ▾". Use it as a dropdown trigger. */
export const MenuChip = forwardRef<HTMLButtonElement, MenuChipProps>(function MenuChip({ icon, active = false, children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className={styles.chip} aria-pressed={active} {...rest}>
      {icon}
      {children}
      <ChevronDown size={12} className={styles.chevron} />
    </button>
  );
});
