import { ArrowRight } from 'lucide-react';
import { sinceText } from './roundText';
import styles from './ReviewRounds.module.css';

/**
 * Where what's new to a reviewer starts: an accent hairline across the timeline, fading out at its ends, and in its
 * middle "Since last review · Nov 9" as words and "See the changes →" as a link. Not one pill of two halves: that read
 * as a toggle.
 */
export function SinceLine({ id, date, onSeeChanges }: { id: string; date: string; onSeeChanges?: () => void }) {
  const { label, day } = sinceText(date);
  return (
    <div id={id} className={styles.since}>
      <span className={styles.sinceMiddle}>
        <span className={styles.sinceLabel}>
          {label}
          {day && <span className={styles.sinceDay}> · {day}</span>}
        </span>
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
