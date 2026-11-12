import { sinceText } from './roundText';
import styles from './ReviewRounds.module.css';

/** Where what's new to a reviewer starts: a hairline in the accent, "Since last review · Nov 9", and its changes. */
export function SinceLine({ id, date, onSeeChanges }: { id: string; date: string; onSeeChanges?: () => void }) {
  return (
    <div id={id} className={styles.since}>
      <span>{sinceText(date)}</span>
      {onSeeChanges && (
        <>
          <span aria-hidden>·</span>
          <button type="button" className={styles.seeChanges} onClick={onSeeChanges}>
            See the changes
          </button>
        </>
      )}
    </div>
  );
}
