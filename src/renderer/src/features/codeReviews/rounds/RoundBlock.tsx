import { Check, ChevronRight, CircleDot } from 'lucide-react';
import type { ReactNode } from 'react';
import { RelativeTime } from '../../../ui/RelativeTime';
import type { ReviewRound } from './reviewRounds';
import { roundText } from './roundText';
import styles from './ReviewRounds.module.css';

/**
 * A closed round: one quiet line (a check once everything in it settled, else a dot), and what it held under it while
 * unfolded. Settled rounds start folded (`ReviewRound.folds`); a click on the line folds or unfolds it.
 */
export function RoundBlock({ round, user, open, onToggle, children }: { round: ReviewRound; user: string | undefined; open: boolean; onToggle: () => void; children: ReactNode }) {
  const Mark = round.folds ? Check : CircleDot;
  return (
    <section className={styles.round} data-settled={round.folds || undefined}>
      <button type="button" className={styles.roundLine} aria-expanded={open} onClick={onToggle}>
        <Mark size={14} className={styles.roundMark} aria-hidden />
        <span className={styles.roundText}>{roundText(round, user)}</span>
        <RelativeTime date={round.date} />
        <ChevronRight size={14} className={styles.chevron} aria-hidden />
      </button>
      {open && <div className={styles.roundEntries}>{children}</div>}
    </section>
  );
}
