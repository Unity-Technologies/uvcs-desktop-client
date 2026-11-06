import type { CodeReviewer } from '@shared/domain/codeReview';
import { Avatar } from '../../ui/Avatar';
import { displayName } from '../../lib/userName';
import { reviewersText, shownReviewers } from './reviewers';
import styles from './ReviewerStack.module.css';

/**
 * The reviewers of a review in a row: each one's avatar, marked with the status they gave, then "+N" for the rest.
 * The tooltip names each with their status.
 */
export function ReviewerStack({ reviewers }: { reviewers: readonly CodeReviewer[] }) {
  const { shown, more } = shownReviewers(reviewers);
  if (shown.length === 0) return <span className={styles.nobody}>Nobody</span>;

  return (
    <span className={styles.stack} data-tip={reviewersText(reviewers)} aria-label={reviewersText(reviewers)}>
      {shown.map((reviewer) => (
        <span key={reviewer.name} className={styles.reviewer} data-status={reviewer.status}>
          <Avatar user={reviewer.name} size={18} tip={null} />
        </span>
      ))}
      {more > 0 && <span className={styles.more}>+{more}</span>}
      {shown.length === 1 && <span className={styles.name}>{displayName(shown[0]!.name)}</span>}
    </span>
  );
}
