import { ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { RelativeTime } from '../../../ui/RelativeTime';
import { reviewerChangesText } from './reviewEventText';
import type { ShownEvent } from './reviewThreads';
import { TimelineEventRow } from './TimelineEventRow';
import styles from './ReviewConversation.module.css';

/** Several reviewer changes in a row as one quiet line (`foldReviewerChanges`); a click lists each. */
export function ReviewerChangesRow({ events }: { events: readonly ShownEvent[] }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div className={styles.eventRun}>
        {events.map((event) => (
          <TimelineEventRow key={event.id} event={event} />
        ))}
      </div>
    );
  }
  return (
    <div className={styles.event}>
      <span className={styles.eventIcon}>
        <Users size={14} aria-hidden />
      </span>
      <p className={styles.eventLine}>
        <button type="button" className={styles.eventRunToggle} aria-expanded={false} onClick={() => setOpen(true)}>
          {reviewerChangesText(events)}
          <ChevronRight size={13} aria-hidden />
        </button>
        <RelativeTime date={events.at(-1)!.date} />
      </p>
    </div>
  );
}
