import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './SettingsDialog.module.css';

interface SettingsChoiceProps {
  icon: ReactNode;
  label: string;
  /** One line under the label, cut to fit; a warning wraps instead. */
  description: string;
  /** The description's tooltip, e.g. a path cut off, or the rule a choice follows. */
  tip?: string;
  selected: boolean;
  onSelect: () => void;
  /** Can't be chosen now (not there, still looked for): shown, greyed. */
  disabled?: boolean;
  /** Its description draws the eye: it may not do all it should. */
  warning?: boolean;
  /** A small button at the card's end, apart from choosing it (Update, on an installed one too old to choose). */
  action?: ReactNode;
}

/** One card of a settings radio group (the theme, the merge tool), checked when selected. */
export function SettingsChoice({ icon, label, description, tip, selected, onSelect, disabled = false, warning = false, action }: SettingsChoiceProps) {
  const card = (
    <button type="button" role="radio" aria-checked={selected} className={styles.choice} data-selected={selected} disabled={disabled} onClick={onSelect}>
      {icon}
      <span className={styles.choiceText}>
        <span className={styles.choiceLabel}>{label}</span>
        {/* A warning wraps: cut, it would hide the version it asks for. */}
        <span className={warning ? styles.choiceDescription : `${styles.choiceDescription} ${styles.oneLine}`} data-tip={tip} data-warning={warning || undefined}>
          {description}
        </span>
      </span>
      {selected && <Check size={14} />}
    </button>
  );
  if (!action) return card;
  // Beside the card's button, never in it: a button can't hold another.
  return (
    <div className={styles.choiceWithAction}>
      {card}
      <span className={styles.choiceAction}>{action}</span>
    </div>
  );
}
