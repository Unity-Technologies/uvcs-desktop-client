import { Check, ChevronRight, CircleDot } from 'lucide-react';
import { RelativeTime } from '../../../ui/RelativeTime';
import type { ReviewRound } from './reviewRounds';
import { roundText } from './roundText';
import conversation from '../conversation/ReviewConversation.module.css';
import styles from './ReviewRounds.module.css';

/**
 * Where a closed round starts, as one more event on the timeline: its mark on the rail (a check once everything in it
 * settled, else a dot), then what the round was. A click folds what it held away and back; folded, the line alone
 * stands for the round. Left-aligned with the events, never a box or a line across: the timeline stays one timeline.
 */
export function RoundMarker({ round, user, open, onToggle }: { round: ReviewRound; user: string | undefined; open: boolean; onToggle: () => void }) {
  const Mark = round.folds ? Check : CircleDot;
  const { name, detail } = roundText(round, user);
  return (
    <div className={conversation.event} data-round={round.folds ? 'settled' : 'open'}>
      <span className={conversation.eventIcon}>
        <Mark size={14} aria-hidden />
      </span>
      <button type="button" className={styles.roundLine} aria-expanded={open} onClick={onToggle}>
        <span className={styles.roundText}>
          <b>{name}</b> · {detail}
        </span>
        <RelativeTime date={round.date} />
        <ChevronRight size={14} className={styles.chevron} aria-hidden />
      </button>
    </div>
  );
}
