import { ChevronRight } from 'lucide-react';
import { FoldedComment } from '../../../components/FoldedComment';
import { ReferenceChip } from '../../../components/comments/ReferenceChip';
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
 * said with that status shows under the line, with the changeset it was given at, so the verdict and its words read at a
 * glance; a click shows what the round held under the line, the status's own event at its end (which then names the
 * changeset), and folds it back.
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
  const Mark = REVIEW_STATUS_ICONS[round.status];
  const { bold, rest, changeset, counts } = roundText(round, user, roundCount, open);
  const comment = roundLineComment(round, open);
  return (
    <div className={conversation.event} data-icon={round.status}>
      <span className={conversation.eventIcon}>
        <Mark size={14} aria-hidden />
      </span>
      <div className={conversation.eventBody}>
        {/* The whole line folds the round: its button lies over it, under the changeset, a link of its own (a link can't
            sit inside a button). The button carries the line's words; the words drawn are for the eye. */}
        <div className={styles.roundLine}>
          <button type="button" className={styles.roundToggle} aria-expanded={open} aria-label={`${bold}${rest}${changeset !== undefined ? ` ${changeset}` : ''}${counts}`} onClick={onToggle} />
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
          {/* After a changeset, its number and the time's would read as one ("9 5 minutes ago"): a dot between. */}
          {changeset !== undefined && !counts && (
            <span className={conversation.eventSeparator} aria-hidden>
              ·
            </span>
          )}
          <RelativeTime date={round.date} />
          <ChevronRight size={14} className={styles.chevron} aria-hidden />
        </div>
        {comment && (
          <div className={`${conversation.eventComment} ${conversation.markdown}`}>
            <FoldedComment titleClassName="" description={comment} titleLines={1} descriptionLines={ROUND_COMMENT_LINES} />
          </div>
        )}
      </div>
    </div>
  );
}
