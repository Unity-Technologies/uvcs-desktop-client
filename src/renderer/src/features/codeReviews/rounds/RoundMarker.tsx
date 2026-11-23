import { ChevronsDownUp } from 'lucide-react';
import { FoldedComment } from '../../../components/FoldedComment';
import { ReferenceChip } from '../../../components/comments/ReferenceChip';
import { RelativeTime } from '../../../ui/RelativeTime';
import { REVIEW_STATUS_ICONS } from '../reviewStatusIcons';
import { FoldableLine } from '../conversation/FoldableLine';
import type { ReviewRound } from './reviewRounds';
import { roundLineComment } from './roundFolds';
import { roundText } from './roundText';
import conversation from '../conversation/ReviewConversation.module.css';
import styles from './ReviewRounds.module.css';

/** How many lines of what the reviewer said show under a folded round's line before "Show more". */
const ROUND_COMMENT_LINES = 4;

/**
 * Where a closed round starts, as one more event on the timeline. Folded, it is the verdict: its mark on the rail is the
 * status that closed it (Reviewed's thumbs-up, Rework required's flag, in their colors), and what the reviewer said with
 * it shows under the line, with the changeset it was given at and when. A click anywhere on the line unfolds what the
 * round held under it, the line then a heading (whose review, what it settled) and the status's own event at its end
 * the verdict, and folds it back.
 */
export function RoundMarker({
  round,
  roundCount,
  user,
  open,
  onToggle,
}: {
  round: ReviewRound;
  /** How many rounds the conversation shows: a review's only round goes unnamed (`roundName`). */
  roundCount: number;
  user: string | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  // Folded, the line is the verdict: its status's mark and time. Unfolded, it heads what the round held, so a neutral
  // mark and no time: the status's own event at its end shows them once (repeated, they read as a second review).
  const Mark = open ? ChevronsDownUp : REVIEW_STATUS_ICONS[round.status];
  const { bold, rest, changeset, counts, label, dotBeforeTime } = roundText(round, user, roundCount, open);
  const comment = roundLineComment(round, open);
  return (
    <div className={conversation.event} data-icon={open ? undefined : round.status}>
      <span className={conversation.eventIcon}>
        <Mark size={14} aria-hidden />
      </span>
      <div className={conversation.eventBody}>
        {/* The chevron carries the line's words; the words drawn are for the eye, and say themselves whole in the
            line's tooltip when cut off. */}
        <FoldableLine className={styles.roundLine} open={open} onToggle={onToggle} label={label} tip={label}>
          <span className={styles.roundText} aria-hidden>
            <b>{bold}</b>
            {rest}
          </span>
          {changeset !== undefined && (
            <span className={styles.roundChangeset}>
              <ReferenceChip reference={{ kind: 'changeset', id: changeset }} source={`cs:${changeset}`} plain />
            </span>
          )}
          {counts && (
            <span className={styles.roundCounts} aria-hidden>
              {counts}
            </span>
          )}
          {dotBeforeTime && (
            <span className={`${conversation.eventSeparator} ${styles.roundSeparator}`} aria-hidden>
              ·
            </span>
          )}
          {!open && <RelativeTime date={round.date} />}
        </FoldableLine>
        {comment && (
          <div className={`${conversation.eventComment} ${conversation.markdown}`}>
            <FoldedComment titleClassName="" description={comment} titleLines={1} descriptionLines={ROUND_COMMENT_LINES} />
          </div>
        )}
      </div>
    </div>
  );
}
