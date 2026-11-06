import type { CodeReviewer } from '@shared/domain/codeReview';
import { Avatar } from '../../ui/Avatar';
import { NO_REVIEWERS, reviewersText, shownReviewers, statusMarked } from './reviewers';
import { REVIEW_STATUS_ICONS } from './ReviewStatusIcon';
import styles from './ReviewerStack.module.css';

/**
 * The reviewers of a review in a row: each one's avatar, the status they gave in a corner of it once they gave one
 * (`statusMarked`), then "+N" for the rest.
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
          {statusMarked(reviewer.status) && <StatusCorner status={reviewer.status} />}
        </span>
      ))}
      {more > 0 && <span className={styles.more}>+{more}</span>}
      {soleName && <span className={styles.name}>{soleName}</span>}
    </span>
  );
}

function StatusCorner({ status }: { status: CodeReviewer['status'] }) {
  const Icon = REVIEW_STATUS_ICONS[status];
  return (
    <span className={styles.status} aria-hidden>
      <Icon size={7} strokeWidth={3} />
    </span>
  );
}
