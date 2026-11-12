import { ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { RelativeTime } from '../../../ui/RelativeTime';
import { reviewerChangesText } from './reviewEventText';
import type { ShownEvent } from './reviewThreads';
import { TimelineEventRow } from './TimelineEventRow';
import styles from './ReviewConversation.module.css';

/**
 * Several reviewer changes in a row as one quiet line (`foldReviewerChanges`); a click on it lists each under it, and
 * folds them back, as a batch of check-ins does.
 */
export function ReviewerChangesRow({ events }: { events: readonly ShownEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.eventRun}>
      <div className={styles.event}>
        <span className={styles.eventIcon}>
          <Users size={14} aria-hidden />
        </span>
        <p className={styles.eventLine}>
          <button type="button" className={styles.eventRunToggle} aria-expanded={open} onClick={() => setOpen(!open)}>
            {reviewerChangesText(events)}
            <ChevronRight size={13} aria-hidden />
          </button>
          <RelativeTime date={events.at(-1)!.date} />
        </p>
      </div>
      {open && events.map((event) => <TimelineEventRow key={event.id} event={event} />)}
    </div>
  );
}
