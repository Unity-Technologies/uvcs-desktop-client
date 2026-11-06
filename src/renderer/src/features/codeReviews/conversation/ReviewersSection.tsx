import { RotateCcw, Settings, X } from 'lucide-react';
import { useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { FilterPopover } from '../../../ui/FilterPopover';
import { IconButton } from '../../../ui/IconButton';
import { changeReviewers, removeReviewer, reRequestReview } from '../codeReviewOperations';
import { canReRequest, isAuthor, reviewerChanges } from '../reviewers';
import { ReviewStatusIcon } from '../ReviewStatusIcon';
import { ReviewerPicker } from './ReviewerPicker';
import styles from './ReviewConversation.module.css';

/**
 * Who reviews it: each reviewer with the status they gave as its icon, the author marked; under the pointer, asking
 * one again (once they gave a status) and taking them off. The heading's button picks reviewers from the server's users.
 */
export function ReviewersSection({ review }: { review: CodeReview }) {
  const place = usePlace();
  const [picked, setPicked] = useState<string[] | null>(null);

  const openPicker = (open: boolean): void => {
    if (open) {
      setPicked(review.reviewers.map((reviewer) => reviewer.name));
      return;
    }
    if (picked) void changeReviewers(place, review, reviewerChanges(review.reviewers, picked));
    setPicked(null);
  };

  return (
    <section className={styles.railSection} aria-labelledby="review-reviewers">
      <div className={styles.railHeading}>
        <h2 id="review-reviewers" className={styles.railTitle}>
          Reviewers
        </h2>
        <FilterPopover
          width={300}
          open={picked !== null}
          onOpenChange={openPicker}
          trigger={<IconButton size="small" icon={<Settings size={14} />} label="Change reviewers" />}
        >
          {picked && <ReviewerPicker review={review} picked={picked} onPickedChange={setPicked} />}
        </FilterPopover>
      </div>
      {review.reviewers.length === 0 && <p className={styles.railEmpty}>Nobody yet</p>}
      <ul className={styles.reviewers}>
        {review.reviewers.map((reviewer) => (
          <li key={reviewer.name} className={styles.reviewer}>
            <ReviewStatusIcon status={reviewer.status} label={reviewer.status} />
            <Avatar user={reviewer.name} size={20} />
            <span className={styles.reviewerName}>
              {displayName(reviewer.name)}
            </span>
            {isAuthor(review, reviewer.name) && <span className={styles.pill}>Author</span>}
            <span className={styles.reviewerActions}>
              {canReRequest(reviewer) && (
                <IconButton size="small" icon={<RotateCcw size={13} />} label="Ask to review again" onClick={() => void reRequestReview(place, review, reviewer.name)} />
              )}
              <IconButton size="small" icon={<X size={13} />} label="Remove reviewer" onClick={() => void removeReviewer(place, review, reviewer.name)} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
