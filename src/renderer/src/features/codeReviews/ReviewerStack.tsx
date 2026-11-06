import type { CodeReviewer } from '@shared/domain/codeReview';
import { AvatarStack } from '../../ui/AvatarStack';
import { NO_REVIEWERS, reviewerRing, reviewersText, reviewerText, shownReviewers } from './reviewers';
import styles from './ReviewerStack.module.css';

/**
 * The reviewers of a review, their avatars stacked, each ringed in the color of the status they gave, then "+N" for
 * the rest. Hovered, the stack spreads and each avatar names its reviewer with their status; a sole reviewer's name
 * shows beside their avatar.
 */
export function ReviewerStack({ reviewers }: { reviewers: readonly CodeReviewer[] }) {
  const { shown, rest, soleName } = shownReviewers(reviewers);
  if (shown.length === 0) return <span className={styles.nobody}>{NO_REVIEWERS}</span>;

  return (
    <span className={styles.reviewers}>
      <AvatarStack
        avatars={shown.map((reviewer) => ({ user: reviewer.name, tip: reviewerText(reviewer), ring: reviewerRing(reviewer.status) }))}
        size={18}
        more={rest.length > 0 ? { count: rest.length, tip: reviewersText(rest) } : undefined}
        label={reviewersText(reviewers)}
      />
      {soleName && <span className={styles.name}>{soleName}</span>}
    </span>
  );
}
