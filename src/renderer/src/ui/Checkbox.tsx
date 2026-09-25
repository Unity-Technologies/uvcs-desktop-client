import { Check, Minus } from 'lucide-react';
import styles from './Checkbox.module.css';

export type CheckState = boolean | 'mixed';

interface CheckboxProps {
  checked: CheckState;
  onChange: (checked: boolean) => void;
  label?: string;
  /** The name screen readers give a checkbox without a visible label. */
  ariaLabel?: string;
  /** False inside a list that toggles it from the keyboard itself (Space), so Tab doesn't stop at every row. */
  focusable?: boolean;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, ariaLabel, focusable = true, disabled }: CheckboxProps) {
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={focusable ? undefined : -1}
      disabled={disabled}
      className={styles.box}
      data-state={checked === 'mixed' ? 'mixed' : checked ? 'checked' : 'unchecked'}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onChange(checked !== true);
      }}
    >
      {checked === 'mixed' ? <Minus size={11} strokeWidth={3} /> : checked && <Check size={11} strokeWidth={3} />}
    </button>
  );

  if (!label) return box;
  return (
    <label className={styles.labeled}>
      {box}
      <span>{label}</span>
    </label>
  );
}
