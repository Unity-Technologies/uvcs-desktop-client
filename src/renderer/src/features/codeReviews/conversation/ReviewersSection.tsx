import { RotateCcw, Settings, X } from 'lucide-react';
import { useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Avatar } from '../../../ui/Avatar';
import { FilterPopover } from '../../../ui/FilterPopover';
import { GroupAvatar } from '../../../ui/GroupAvatar';
import { IconButton } from '../../../ui/IconButton';
import { changeReviewers, removeReviewer, reRequestReview } from '../codeReviewOperations';
import { isGroup, reviewerLabel, reviewerRef } from '../reviewerGroups';
import { canReRequest, isAuthor } from '../reviewers';
import { pickChanges, startPick, type ReviewerPick } from '../reviewerPick';
import { ReviewStatusIcon } from '../ReviewStatusIcon';
import { useReviewerGroups } from '../useReviewerGroups';
import { useReviewersOf } from '../useReviewersOf';
import { ReviewerPicker } from './ReviewerPicker';
import styles from './ReviewConversation.module.css';

/**
 * Who reviews it: each reviewer with the status they gave as its icon, a group with the group icon, the author marked;
 * under the pointer, asking one again (once they gave a status) and taking them off. The heading's button picks
 * reviewers from the server's users and groups.
 */
export function ReviewersSection({ review }: { review: CodeReview }) {
  const place = usePlace();
  const user = usePlaceUser();
  const groups = useReviewerGroups();
  const { reviewers } = useReviewersOf(review);
  const [pick, setPick] = useState<ReviewerPick | null>(null);

  const openPicker = (open: boolean): void => {
    if (open) {
      setPick(startPick(reviewers, groups));
      return;
    }
    if (pick) void changeReviewers(place, review, pickChanges(pick, groups));
    setPick(null);
  };

  return (
    <section className={styles.railSection} aria-labelledby="review-reviewers">
      <div className={styles.railHeading}>
        <h2 id="review-reviewers" className={styles.railTitle}>
          Reviewers
        </h2>
        <FilterPopover
          width={300}
          open={pick !== null}
          onOpenChange={openPicker}
          trigger={<IconButton size="small" icon={<Settings size={14} />} label="Change reviewers" />}
        >
          {pick && <ReviewerPicker pick={pick} onPickChange={setPick} />}
        </FilterPopover>
      </div>
      {reviewers.length === 0 && <p className={styles.railEmpty}>Nobody yet</p>}
      <ul className={styles.reviewers}>
        {reviewers.map((reviewer) => (
          <li key={reviewer.name} className={styles.reviewer}>
            <ReviewStatusIcon status={reviewer.status} label={reviewer.status} />
            {isGroup(reviewer, groups) ? <GroupAvatar size={20} tip="Group" /> : <Avatar user={reviewer.name} size={20} />}
            <span className={styles.reviewerName}>
              {reviewerLabel(reviewer, groups)}
              {isGroup(reviewer, groups) && <span className="visually-hidden"> (group)</span>}
            </span>
            {isAuthor(review, reviewer.name) && <span className={styles.pill}>Author</span>}
            <span className={styles.reviewerActions}>
              {canReRequest(reviewer, user) && (
                <IconButton
                  size="small"
                  icon={<RotateCcw size={13} />}
                  label="Ask to review again"
                  onClick={() => void reRequestReview(place, review, reviewerRef(reviewer, groups))}
                />
              )}
              <IconButton size="small" icon={<X size={13} />} label="Remove reviewer" onClick={() => void removeReviewer(place, review, reviewerRef(reviewer, groups))} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
