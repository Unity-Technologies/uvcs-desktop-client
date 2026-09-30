import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './SettingsDialog.module.css';

interface SettingsChoiceProps {
  icon: ReactNode;
  label: string;
  /** One line under the label; cut to fit. */
  description: string;
  /** The description's tooltip, e.g. a path cut off, or the rule a choice follows. */
  tip?: string;
  selected: boolean;
  onSelect: () => void;
}

/** One card of a settings radio group (the theme, the merge tool), checked when selected. */
export function SettingsChoice({ icon, label, description, tip, selected, onSelect }: SettingsChoiceProps) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={styles.choice} data-selected={selected} onClick={onSelect}>
      {icon}
      <span className={styles.choiceText}>
        <span className={styles.choiceLabel}>{label}</span>
        <span className={`${styles.choiceDescription} ${styles.oneLine}`} data-tip={tip}>
          {description}
        </span>
      </span>
      {selected && <Check size={14} />}
    </button>
  );
}
