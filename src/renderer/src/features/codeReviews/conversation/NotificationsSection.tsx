import { useState } from 'react';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Button } from '../../../ui/Button';
import { setReviewSubscription } from '../codeReviewOperations';
import { useReviewSubscription } from '../useReviewSubscription';
import styles from './ReviewConversation.module.css';

/**
 * Whether the user gets the review's emails and why, and the one button that changes it (`subscriptionSection`).
 * Nothing at all while it's read, when it can't be, or when the repository sends no review emails.
 */
export function NotificationsSection({ reviewId }: { reviewId: number }) {
  const place = usePlace();
  const section = useReviewSubscription(reviewId);
  const [changing, setChanging] = useState(false);
  if (!section) return null;

  const change = async (): Promise<void> => {
    setChanging(true);
    try {
      await setReviewSubscription(place, reviewId, section.subscribes);
    } finally {
      setChanging(false);
    }
  };

  return (
    <section className={styles.railSection} aria-labelledby="review-notifications">
      <h2 id="review-notifications" className={styles.railTitle}>
        Notifications
      </h2>
      <p className={styles.railNote}>{section.text}</p>
      <Button size="small" data-tip={section.buttonTip} loading={changing} onClick={() => void change()}>
        {section.buttonLabel}
      </Button>
    </section>
  );
}
