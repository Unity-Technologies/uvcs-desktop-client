import { Eye, EyeOff, GitBranch, Pencil, RotateCcw, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { FoldedComment } from '../../../components/FoldedComment';
import { ReferenceChip } from '../../../components/comments/ReferenceChip';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { RelativeTime } from '../../../ui/RelativeTime';
import { MERGE_REQUEST_STATE_ICONS } from '../mergeRequestState';
import { REVIEW_STATUS_ICONS } from '../reviewStatusIcons';
import { reviewEventRow, type ReviewEventContext, type ReviewEventIcon } from './reviewEventText';
import type { ShownEvent } from './reviewThreads';
import styles from './ReviewConversation.module.css';

/** How many lines of what a reviewer said with their status show before "Show more". */
const STATUS_COMMENT_LINES = 4;

const ICONS: Record<ReviewEventIcon, LucideIcon> = {
  reviewRequested: UserPlus,
  reviewRequestedAgain: RotateCcw,
  reviewerRemoved: UserMinus,
  renamed: Pencil,
  destinationChanged: GitBranch,
  branchHidden: EyeOff,
  branchUnhidden: Eye,
  ...REVIEW_STATUS_ICONS,
  ...MERGE_REQUEST_STATE_ICONS,
};

/**
 * A quiet line for what the server noted: who did what, when; a status change with what its reviewer said under it, a
 * merge with its changeset as a chip.
 */
export function TimelineEventRow({ event, context }: { event: ShownEvent; context?: ReviewEventContext }) {
  const row = reviewEventRow(event, context);
  const Icon = ICONS[row.icon];
  return (
    <div className={styles.event} data-icon={row.icon}>
      <span className={styles.eventIcon}>
        <Icon size={14} aria-hidden />
      </span>
      <div className={styles.eventBody}>
        <p className={styles.eventLine}>
          <Avatar user={event.author} size={18} />
          <span className={styles.author}>{displayName(event.author)}</span> {row.text}
          {row.changeset !== undefined && (
            <span className={styles.eventChangeset}>
              <ReferenceChip reference={{ kind: 'changeset', id: row.changeset }} source={`cs:${row.changeset}`} compact />
            </span>
          )}{' '}
          <RelativeTime date={event.date} />
        </p>
        {row.comment && (
          // Folded past a few lines, "Show more" opening it: a status can come with a wall of text.
          <div className={`${styles.eventComment} ${styles.markdown}`}>
            <FoldedComment titleClassName="" description={row.comment} titleLines={1} descriptionLines={STATUS_COMMENT_LINES} />
          </div>
        )}
      </div>
    </div>
  );
}
