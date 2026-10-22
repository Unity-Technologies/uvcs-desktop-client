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
  /**
   * `cards`: a bordered card per option, its description under its title. `list`: a radio row per option, and only
   * the chosen option's description, once, under the list, for a choice that should take little room. A disabled
   * option's description (why it is disabled) would never show there, so `list` is for options never disabled.
   */
  layout?: 'cards' | 'list';
}

/** A radio group of options with a title and a line of explanation each, for choices that need a sentence. */
export function OptionCards<T extends string>({ label, heading = false, cards, value, onChange, layout = 'cards' }: OptionCardsProps<T>) {
  const name = useId();
  const descriptionId = useId();
  const list = layout === 'list';
  const chosenDescription = list ? cards.find((card) => card.value === value)?.description : undefined;
  return (
    <div className={styles.group} role="radiogroup" aria-label={label} data-layout={layout}>
      {heading && <div className={styles.heading}>{label}</div>}
      {cards.map((card) => (
        <label key={card.value} className={styles.card} data-selected={value === card.value} data-disabled={card.disabled ?? false}>
          <input
            type="radio"
            name={name}
            checked={value === card.value}
            disabled={card.disabled}
            // On the checked radio, so moving to another reads its description, which the list shows only once.
            aria-describedby={chosenDescription && value === card.value ? descriptionId : undefined}
            onChange={() => onChange(card.value)}
          />
          <span className={styles.text}>
            <span className={styles.title}>{card.title}</span>
            {!list && <span className={styles.description}>{card.description}</span>}
          </span>
        </label>
      ))}
      {chosenDescription && (
        <div id={descriptionId} className={styles.listDescription}>
          {chosenDescription}
        </div>
      )}
    </div>
  );
}
