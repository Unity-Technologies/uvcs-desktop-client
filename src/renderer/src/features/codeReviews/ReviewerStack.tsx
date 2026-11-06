import type { CodeReviewer } from '@shared/domain/codeReview';
import { AvatarStack } from '../../ui/AvatarStack';
import { NO_REVIEWERS, REVIEWER_AVATAR_SIZE, reviewersText, stackedReviewers } from './reviewers';
import { useReviewerGroups } from './useReviewerGroups';
import styles from './ReviewerStack.module.css';

/**
 * The reviewers of a review, their avatars stacked (a group's icon for a group), then "+N" for the rest. Hovered, the
 * stack spreads and each avatar names its reviewer with their status; a sole reviewer's name shows beside their avatar.
 */
export function ReviewerStack({ reviewers }: { reviewers: readonly CodeReviewer[] }) {
  const groups = useReviewerGroups();
  if (reviewers.length === 0) return <span className={styles.nobody}>{NO_REVIEWERS}</span>;
  const { avatars, more, soleName } = stackedReviewers(reviewers, groups);

  return (
    <span className={styles.reviewers}>
      <AvatarStack avatars={avatars} size={REVIEWER_AVATAR_SIZE} more={more} label={reviewersText(reviewers, groups)} />
      {soleName && <span className={styles.name}>{soleName}</span>}
    </span>
  );
}
