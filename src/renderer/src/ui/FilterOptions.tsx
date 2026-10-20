import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './FilterOptions.module.css';

export interface FilterOption {
  id: string;
  label: ReactNode;
  checked: boolean;
  onSelect: () => void;
  /** What the option means where its label is short ("This branch": which one). */
  tip?: string;
}

interface FilterOptionsProps {
  /** What the options choose, for screen readers ("Branches"). */
  label: string;
  options: FilterOption[];
  /** Several on at once (`checkbox`), or one of them (`radio`). */
  kind?: 'checkbox' | 'radio';
}

/** The options at the top of a filter's popover (`FilterPopover`), each a row with its check, above what it picks from. */
export function FilterOptions({ label, options, kind = 'checkbox' }: FilterOptionsProps) {
  return (
    <div role="group" aria-label={label} className={styles.options}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role={kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox'}
          aria-checked={option.checked}
          className={styles.option}
          data-tip={option.tip}
          onClick={option.onSelect}
        >
          <span className={styles.check}>{option.checked && <Check size={13} />}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
