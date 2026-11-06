import { useState } from 'react';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { ReviewerPicker } from './conversation/ReviewerPicker';
import { changesReviewers, dialogChanges, dialogPick, READING_REVIEWERS, type ReviewerChanges, type ReviewerPick } from './reviewerPick';
import { useReviewerGroups } from './useReviewerGroups';
import { useReviewersOf } from './useReviewersOf';
import styles from './ReviewersDialog.module.css';

/**
 * Asks who reviews `review`, with the picker of its page (the reviewers checked, then the server's groups and users):
 * resolves to what the user changed, or undefined when they cancelled.
 */
export function pickReviewers(review: CodeReviewSummary): Promise<ReviewerChanges | undefined> {
  return askDialog<ReviewerChanges>((finish) => <ReviewersDialog review={review} finish={finish} />);
}

function ReviewersDialog({ review, finish }: { review: CodeReviewSummary; finish: (changes: ReviewerChanges | undefined) => void }) {
  const groups = useReviewerGroups();
  // The review's reviewers typed by `cm` first, so a group is removed as one even where the server lists no groups.
  const read = useReviewersOf(review);
  const [picked, setPick] = useState<ReviewerPick | null>(null);
  const pick = dialogPick(picked, read, groups);
  const changes = dialogChanges(pick, groups);
  const changed = changesReviewers(changes);

  return (
    <Dialog
      title="Reviewers"
      description={review.title}
      width={420}
      onClose={() => finish(undefined)}
      onSubmit={() => finish(changes)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!changed}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.picker}>
        {pick ? <ReviewerPicker pick={pick} onPickChange={setPick} /> : <p className={styles.reading}>{READING_REVIEWERS}</p>}
      </div>
    </Dialog>
  );
}
