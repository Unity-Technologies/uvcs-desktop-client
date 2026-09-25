import { Check, Minus } from 'lucide-react';
import styles from './Checkbox.module.css';

export type CheckState = boolean | 'mixed';

interface CheckboxProps {
  checked: CheckState;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
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
