import { Pencil, RotateCcw, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { Markdown } from '../../../components/Markdown';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { RelativeTime } from '../../../ui/RelativeTime';
import { REVIEW_STATUS_ICONS } from '../ReviewStatusIcon';
import { reviewEventRow, type ReviewEventIcon } from './reviewEventText';
import type { ShownEvent } from './reviewThreads';
import styles from './ReviewConversation.module.css';

const ICONS: Record<ReviewEventIcon, LucideIcon> = {
  reviewRequested: UserPlus,
  reviewRequestedAgain: RotateCcw,
  reviewerRemoved: UserMinus,
  renamed: Pencil,
  ...REVIEW_STATUS_ICONS,
};

/** A quiet line for what the server noted: who did what, when; a status change with what its reviewer said under it. */
export function TimelineEventRow({ event }: { event: ShownEvent }) {
  const row = reviewEventRow(event);
  const Icon = ICONS[row.icon];
  return (
    <div className={styles.event} data-icon={row.icon}>
      <span className={styles.eventIcon}>
        <Icon size={14} aria-hidden />
      </span>
      <div className={styles.eventBody}>
        <p className={styles.eventLine}>
          <Avatar user={event.author} size={18} />
          <span className={styles.author}>{displayName(event.author)}</span> {row.text} <RelativeTime date={event.date} />
        </p>
        {row.comment && (
          <div className={`${styles.eventComment} ${styles.markdown} selectable`}>
            <Markdown text={row.comment} comment />
          </div>
        )}
      </div>
    </div>
  );
}
