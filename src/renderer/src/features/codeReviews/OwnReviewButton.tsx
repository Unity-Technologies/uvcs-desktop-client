import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { placeId } from '@shared/domain/place';
import { CODE_REVIEW_STATUSES, type CodeReview, type CodeReviewStatus } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../app/account/accounts';
import { usePlace } from '../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../components/DetailsHeading';
import { Button } from '../../ui/Button';
import { Popover } from '../../ui/Popover';
import { setOwnReviewStatus } from './codeReviewOperations';
import { CommentComposer } from './conversation/CommentComposer';
import { ownReviewButton } from './ownReview';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import styles from './CodeReviewPage.module.css';

/**
 * The user's own review, in the page's header: the status they gave, or Review when they aren't a reviewer. It opens
 * the three statuses to pick from and what they'd say about it, sent with the status.
 */
export function OwnReviewButton({ review }: { review: CodeReview }) {
  const user = usePlaceUser();
  const [open, setOpen] = useState(false);
  const button = ownReviewButton(review, user);

  return (
    <Popover
      width={320}
      align="end"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="primary" icon={button.status && <ReviewStatusIcon status={button.status} size={14} />} className={styles.ownReview}>
          {button.label}
          <ChevronDown size={13} aria-hidden />
        </Button>
      }
    >
      {open && <OwnReviewForm review={review} user={user} onDone={() => setOpen(false)} />}
    </Popover>
  );
}

function OwnReviewForm({ review, user, onDone }: { review: CodeReview; user: string | undefined; onDone: () => void }) {
  const place = usePlace();
  const button = ownReviewButton(review, user);
  const [status, setStatus] = useState<CodeReviewStatus>(button.status ?? 'Reviewed');

  return (
    <div className={styles.ownReviewForm}>
      <fieldset className={styles.statuses}>
        <legend className={styles.formTitle}>Mark your review as</legend>
        {CODE_REVIEW_STATUSES.map((choice) => (
          <label key={choice} className={styles.statusChoice}>
            <input type="radio" name="own-review-status" checked={choice === status} onChange={() => setStatus(choice)} />
            <ReviewStatusIcon status={choice} size={14} />
            {choice}
          </label>
        ))}
      </fieldset>
      {button.joining && <p className={styles.joining}>You'll be added as a reviewer.</p>}
      <CommentComposer
        draftKey={commentDraftKey(placeId(place), 'reviewStatus', review.id)}
        placeholder="Comment (optional)"
        label="What you say about it"
        submitLabel={`Mark as ${status}`}
        optional
        onSubmit={async (comment) => {
          onDone();
          await setOwnReviewStatus(place, review, status, { user, comment, joiningAgreed: true });
          return true;
        }}
      />
    </div>
  );
}
