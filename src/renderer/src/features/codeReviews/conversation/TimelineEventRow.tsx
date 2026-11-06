import { CheckCircle2, CircleDot, Pencil, RotateCcw, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import type { ReviewEvent } from '@shared/domain/reviewConversation';
import { Markdown } from '../../../components/Markdown';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { RelativeTime } from '../../../ui/RelativeTime';
import { reviewEventText } from './reviewEventText';
import styles from './ReviewConversation.module.css';

const ICONS: Record<ReviewEvent['kind'], LucideIcon> = {
  reviewRequested: UserPlus,
  reviewRequestedAgain: RotateCcw,
  reviewerRemoved: UserMinus,
  statusChanged: CircleDot,
  titleChanged: Pencil,
  other: CircleDot,
};

/** A quiet line for what the server noted: who did what, when; a status change with what its reviewer said under it. */
export function TimelineEventRow({ event }: { event: ReviewEvent }) {
  const Icon = event.kind === 'statusChanged' && event.status === 'Reviewed' ? CheckCircle2 : ICONS[event.kind];
  return (
    <div className={styles.event} data-kind={event.kind} data-status={event.kind === 'statusChanged' ? event.status : undefined}>
      <span className={styles.eventIcon}>
        <Icon size={14} aria-hidden />
      </span>
      <div className={styles.eventBody}>
        <p className={styles.eventLine}>
          <Avatar user={event.author} size={18} />
          <span className={styles.author}>{displayName(event.author)}</span> {reviewEventText(event)} <RelativeTime date={event.date} />
        </p>
        {event.kind === 'statusChanged' && event.comment.trim() && (
          <div className={`${styles.eventComment} ${styles.markdown} selectable`}>
            <Markdown text={event.comment} comment />
          </div>
        )}
      </div>
    </div>
  );
}
