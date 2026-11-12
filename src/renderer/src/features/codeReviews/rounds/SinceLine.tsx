import { ArrowRight } from 'lucide-react';
import { sinceText } from './roundText';
import styles from './ReviewRounds.module.css';

/**
 * Where what's new to a reviewer starts, as one more event on the timeline: an accent dot on the rail, breathing
 * quietly, then "New since your last review", its day, a hairline, and "See the changes →" at the end.
 */
export function SinceLine({ id, date, onSeeChanges }: { id: string; date: string; onSeeChanges?: () => void }) {
  const { label, day } = sinceText(date);
  return (
    <div id={id} className={styles.since}>
      <span className={styles.sinceDot} aria-hidden />
      <span className={styles.sinceLine}>
        <span className={styles.sinceLabel}>{label}</span>
        {day && <span className={styles.sinceDay}>{day}</span>}
        <span className={styles.sinceRule} aria-hidden />
        {onSeeChanges && (
          <button type="button" className={styles.seeChanges} onClick={onSeeChanges}>
            See the changes
            <ArrowRight size={13} className={styles.seeChangesArrow} aria-hidden />
          </button>
        )}
      </span>
    </div>
  );
}
