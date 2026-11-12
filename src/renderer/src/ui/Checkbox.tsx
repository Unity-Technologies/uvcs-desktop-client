import { Check, Minus } from 'lucide-react';
import { submitsForm } from './checkboxKeys';
import styles from './Checkbox.module.css';

export type CheckState = boolean | 'mixed';

/** A box that marks a change: `added` fills a check in green, `removed` borders an empty box in red. */
export type CheckboxTone = 'added' | 'removed';

interface CheckboxProps {
  checked: CheckState;
  onChange: (checked: boolean) => void;
  label?: string;
  /** The name screen readers give a checkbox without a visible label. */
  ariaLabel?: string;
  /** False inside a list that toggles it from the keyboard itself (Space), so Tab doesn't stop at every row. */
  focusable?: boolean;
  disabled?: boolean;
  tone?: CheckboxTone;
}

export function Checkbox({ checked, onChange, label, ariaLabel, focusable = true, disabled, tone }: CheckboxProps) {
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={focusable ? undefined : -1}
      disabled={disabled}
      className={styles.box}
      data-tone={tone}
      data-state={checked === 'mixed' ? 'mixed' : checked ? 'checked' : 'unchecked'}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (!submitsForm(event.key)) return;
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }}
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
