import { ChevronRight } from 'lucide-react';
import { FoldedComment } from '../../../components/FoldedComment';
import { RelativeTime } from '../../../ui/RelativeTime';
import { REVIEW_STATUS_ICONS } from '../reviewStatusIcons';
import type { ReviewRound } from './reviewRounds';
import { roundLineComment } from './roundFolds';
import { roundText } from './roundText';
import conversation from '../conversation/ReviewConversation.module.css';
import styles from './ReviewRounds.module.css';

/** How many lines of what the reviewer said show under a folded round's line before "Show more". */
const ROUND_COMMENT_LINES = 4;

/**
 * Where a closed round starts, as one more event on the timeline: its mark on the rail is the status that closed it
 * (Reviewed's thumbs-up, Rework required's flag, in their colors), then what the round was. Folded, what the reviewer
 * said with that status shows under the line, so the verdict and its words read at a glance; a click shows what the
 * round held under the line, the status's own event at its end, and folds it back.
 */
export function RoundMarker({ round, user, open, onToggle }: { round: ReviewRound; user: string | undefined; open: boolean; onToggle: () => void }) {
  const Mark = REVIEW_STATUS_ICONS[round.status];
  const { name, detail } = roundText(round, user);
  const comment = roundLineComment(round, open);
  return (
    <div className={conversation.event} data-icon={round.status}>
      <span className={conversation.eventIcon}>
        <Mark size={14} aria-hidden />
      </span>
      <div className={conversation.eventBody}>
        <button type="button" className={styles.roundLine} aria-expanded={open} onClick={onToggle}>
          <span className={styles.roundText}>
            <b>{name}</b> · {detail}
          </span>
          <RelativeTime date={round.date} />
          <ChevronRight size={14} className={styles.chevron} aria-hidden />
        </button>
        {comment && (
          <div className={`${conversation.eventComment} ${conversation.markdown}`}>
            <FoldedComment titleClassName="" description={comment} titleLines={1} descriptionLines={ROUND_COMMENT_LINES} />
          </div>
        )}
      </div>
    </div>
  );
}
