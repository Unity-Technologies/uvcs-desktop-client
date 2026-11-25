import { RotateCcw, Settings, X } from 'lucide-react';
import { useState, useId } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Avatar } from '../../../ui/Avatar';
import { FilterPopover } from '../../../ui/FilterPopover';
import { GroupAvatar } from '../../../ui/GroupAvatar';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { Tooltip } from '../../../ui/Tooltip';
import { changeReviewers, removeReviewer, reRequestReview } from '../codeReviewOperations';
import { isGroup, reviewerLabel, reviewerRef } from '../reviewerGroups';
import { canReRequest, isAuthor, reviewerActionLabels } from '../reviewers';
import { pickChanges, startPick, type ReviewerPick } from '../reviewerPick';
import { ReviewStatusIcon } from '../ReviewStatusIcon';
import { useReviewerGroups } from '../useReviewerGroups';
import { useReviewersOf } from '../useReviewersOf';
import { ReviewerPicker } from './ReviewerPicker';
import styles from './ReviewConversation.module.css';

/**
 * Who reviews it: each reviewer with the status they gave as its icon, a group with the group icon, the author marked;
 * Ask again, written out on a reviewer who gave a status (the one time it applies), and a quiet × to take them off,
 * both always shown. The heading's button picks reviewers from the server's users and groups.
 */
export function ReviewersSection({ review }: { review: CodeReview }) {
  // Its own per page: a review may show in two views kept mounted (`KeptView`).
  const titleId = useId();
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
    <section className={styles.railSection} aria-labelledby={titleId}>
      <div className={styles.railHeading}>
        <h2 id={titleId} className={styles.railTitle}>
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
        {reviewers.map((reviewer) => {
          const labels = reviewerActionLabels(reviewer, groups);
          const ref = reviewerRef(reviewer, groups);
          return (
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
                  <Tooltip content={labels.askAgain}>
                    <Button
                      size="small"
                      variant="ghost"
                      icon={<RotateCcw size={12} />}
                      aria-label={labels.askAgain}
                      onClick={() => void reRequestReview(place, review, ref)}
                    >
                      Ask again
                    </Button>
                  </Tooltip>
                )}
                <IconButton
                  size="small"
                  className={styles.removeReviewer}
                  icon={<X size={13} />}
                  label={labels.remove}
                  onClick={() => void removeReviewer(place, review, ref)}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
