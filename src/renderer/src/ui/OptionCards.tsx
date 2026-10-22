import { useId, type ReactNode } from 'react';
import styles from './OptionCards.module.css';

export interface OptionCard<T extends string> {
  value: T;
  title: ReactNode;
  description: ReactNode;
  disabled?: boolean;
}

interface OptionCardsProps<T extends string> {
  /** Accessible name of the group; shown above the cards when `heading` is set. */
  label: string;
  heading?: boolean;
  cards: OptionCard<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** A radio group of cards with a title and a line of explanation each, for choices that need a sentence. */
export function OptionCards<T extends string>({ label, heading = false, cards, value, onChange }: OptionCardsProps<T>) {
  const name = useId();
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {heading && <div className={styles.heading}>{label}</div>}
      {cards.map((card) => (
        <label key={card.value} className={styles.card} data-selected={value === card.value} data-disabled={card.disabled ?? false}>
          <input type="radio" name={name} checked={value === card.value} disabled={card.disabled} onChange={() => onChange(card.value)} />
          <span className={styles.text}>
            <span className={styles.title}>{card.title}</span>
            <span className={styles.description}>{card.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
