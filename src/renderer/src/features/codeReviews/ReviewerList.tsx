import type { CodeReviewer } from '@shared/domain/codeReview';
import { Avatar } from '../../ui/Avatar';
import { DetailsEmpty } from '../../ui/DetailsSection';
import { GroupAvatar } from '../../ui/GroupAvatar';
import { isGroup, reviewerLabel } from './reviewerGroups';
import { NO_REVIEWERS } from './reviewers';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import { useReviewerGroups } from './useReviewerGroups';
import styles from './ReviewerList.module.css';

/**
 * A review's reviewers, one per line: the status each gave as its icon, then their avatar (a group's icon for a group)
 * and name. Read only: the review's page changes them (`ReviewersSection`).
 */
export function ReviewerList({ reviewers }: { reviewers: readonly CodeReviewer[] }) {
  const groups = useReviewerGroups();
  if (reviewers.length === 0) return <DetailsEmpty>{NO_REVIEWERS}</DetailsEmpty>;
  return (
    <ul className={styles.reviewers}>
      {reviewers.map((reviewer) => (
        <li key={reviewer.name} className={styles.reviewer}>
          <ReviewStatusIcon status={reviewer.status} label={reviewer.status} />
          {isGroup(reviewer, groups) ? <GroupAvatar size={18} tip="Group" /> : <Avatar user={reviewer.name} size={18} />}
          <span className={styles.name}>
            {reviewerLabel(reviewer, groups)}
            {isGroup(reviewer, groups) && <span className="visually-hidden"> (group)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
