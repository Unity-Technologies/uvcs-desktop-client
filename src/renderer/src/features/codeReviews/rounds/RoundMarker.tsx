import { Check, ChevronRight, CircleDot } from 'lucide-react';
import { RelativeTime } from '../../../ui/RelativeTime';
import type { ReviewRound } from './reviewRounds';
import { roundText } from './roundText';
import styles from './ReviewRounds.module.css';

/**
 * Where a closed round starts in the timeline: a quiet hairline across it, as the "Since last review" line is, with
 * what the round was in its middle (a check once everything in it settled, else a dot). A click folds what it held
 * away and back; folded, the line alone stands for the round. Not a box: the timeline stays one timeline, its entries
 * at one indent.
 */
export function RoundMarker({ round, user, open, onToggle }: { round: ReviewRound; user: string | undefined; open: boolean; onToggle: () => void }) {
  const Mark = round.folds ? Check : CircleDot;
  return (
    <button type="button" className={styles.roundMarker} data-settled={round.folds || undefined} aria-expanded={open} onClick={onToggle}>
      <span className={styles.roundLabel}>
        <Mark size={14} className={styles.roundMark} aria-hidden />
        <span className={styles.roundText}>{roundText(round, user)}</span>
        <span aria-hidden>·</span>
        <RelativeTime date={round.date} />
        <ChevronRight size={14} className={styles.chevron} aria-hidden />
      </span>
    </button>
  );
}
