import { Users } from 'lucide-react';
import { useState } from 'react';
import { RelativeTime } from '../../../ui/RelativeTime';
import { FoldableLine } from './FoldableLine';
import { reviewerChangesText } from './reviewEventText';
import type { ShownEvent } from './reviewThreads';
import { TimelineEventRow } from './TimelineEventRow';
import styles from './ReviewConversation.module.css';

/**
 * Several reviewer changes in a row as one quiet line (`foldReviewerChanges`); a click anywhere on it lists each under
 * it, and folds them back, as a batch of check-ins does.
 */
export function ReviewerChangesRow({ events }: { events: readonly ShownEvent[] }) {
  const [open, setOpen] = useState(false);
  const text = reviewerChangesText(events);
  return (
    <div className={styles.eventRun}>
      <div className={styles.event}>
        <span className={styles.eventIcon}>
          <Users size={14} aria-hidden />
        </span>
        <FoldableLine className={styles.eventLine} open={open} onToggle={() => setOpen(!open)} label={text}>
          {text}
          <RelativeTime date={events.at(-1)!.date} />
        </FoldableLine>
      </div>
      {open && events.map((event) => <TimelineEventRow key={event.id} event={event} />)}
    </div>
  );
}
