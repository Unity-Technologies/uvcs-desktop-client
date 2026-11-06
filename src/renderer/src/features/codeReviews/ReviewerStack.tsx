import type { CodeReviewer } from '@shared/domain/codeReview';
import { Avatar } from '../../ui/Avatar';
import { NO_REVIEWERS, reviewersText, shownReviewers } from './reviewers';
import styles from './ReviewerStack.module.css';

/**
 * The reviewers of a review in a row: each one's avatar, marked with the status they gave, then "+N" for the rest.
 * The tooltip names each with their status.
 */
export function ReviewerStack({ reviewers }: { reviewers: readonly CodeReviewer[] }) {
  const { shown, more, soleName } = shownReviewers(reviewers);
  if (shown.length === 0) return <span className={styles.nobody}>{NO_REVIEWERS}</span>;

  return (
    <span className={styles.stack} data-tip={reviewersText(reviewers)} aria-label={reviewersText(reviewers)}>
      {shown.map((reviewer) => (
        <span key={reviewer.name} className={styles.reviewer} data-status={reviewer.status}>
          <Avatar user={reviewer.name} size={18} tip={null} />
        </span>
      ))}
      {more > 0 && <span className={styles.more}>+{more}</span>}
      {soleName && <span className={styles.name}>{soleName}</span>}
    </span>
  );
}
