import { ChevronDown, Info } from 'lucide-react';
import { useRef, useState, type Ref } from 'react';
import { placeId } from '@shared/domain/place';
import { CODE_REVIEW_STATUSES, type CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../app/account/accounts';
import { usePlace } from '../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../components/DetailsHeading';
import { Button } from '../../ui/Button';
import { Popover } from '../../ui/Popover';
import { setOwnReviewStatus } from './codeReviewOperations';
import { CommentComposer } from './conversation/CommentComposer';
import { ownReviewButton, ownReviewChoice } from './ownReview';
import { useOwnReviewChoiceStore } from './ownReviewChoiceStore';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import { REVIEW_STATUS_ICONS } from './reviewStatusIcons';
import styles from './CodeReviewPage.module.css';

/**
 * The user's own review, in the page's header: the status they gave, or Review when they aren't a reviewer. It opens
 * the three statuses to pick from and what they'd say about it, sent with the status.
 */
export function OwnReviewButton({ review }: { review: CodeReview }) {
  const user = usePlaceUser();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const button = ownReviewButton(review, user);
  // In the button's own color: a status's color on the button's fill can't be read.
  const StatusIcon = button.status && REVIEW_STATUS_ICONS[button.status];

  return (
    <Popover
      width={320}
      align="end"
      open={open}
      onOpenChange={setOpen}
      onOpenAutoFocus={(event) => {
        // On the status picked, not the first: reopened with Reviewed kept, Space there would pick Under review unnoticed.
        event.preventDefault();
        formRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
      }}
      trigger={
        <Button variant="primary" icon={StatusIcon && <StatusIcon size={14} aria-hidden />} className={styles.ownReview}>
          {button.label}
          <ChevronDown size={13} aria-hidden />
        </Button>
      }
    >
      {open && <OwnReviewForm ref={formRef} review={review} user={user} onDone={() => setOpen(false)} />}
    </Popover>
  );
}

function OwnReviewForm({ ref, review, user, onDone }: { ref: Ref<HTMLDivElement>; review: CodeReview; user: string | undefined; onDone: () => void }) {
  const place = usePlace();
  const button = ownReviewButton(review, user);
  // Kept with the comment, under its key, as the popover closes: reopened, it shows the whole draft (`useOwnReviewChoiceStore`).
  const draftKey = commentDraftKey(placeId(place), 'reviewStatus', review.id);
  const chosen = useOwnReviewChoiceStore((state) => state.choices[draftKey]);
  const choose = useOwnReviewChoiceStore((state) => state.choose);
  const forget = useOwnReviewChoiceStore((state) => state.forget);
  const status = ownReviewChoice(button, chosen);

  return (
    <div ref={ref} className={styles.ownReviewForm}>
      <fieldset className={styles.statuses}>
        <legend className={styles.formTitle}>Mark your review as</legend>
        {CODE_REVIEW_STATUSES.map((choice) => (
          <label key={choice} className={styles.statusChoice}>
            <input type="radio" name="own-review-status" checked={choice === status} onChange={() => choose(draftKey, choice)} />
            <ReviewStatusIcon status={choice} size={14} />
            {choice}
          </label>
        ))}
      </fieldset>
      {button.joining && (
        <p className={styles.formNote}>
          <Info size={14} aria-hidden />
          You'll be added as a reviewer.
        </p>
      )}
      <CommentComposer
        draftKey={draftKey}
        placeholder="Comment (optional)"
        label="What you say about it"
        submitLabel={`Mark as ${status}`}
        optional
        inPopover
        onSubmit={async (comment) => {
          // Closes once set, the draft gone (its comment with it: `CommentComposer`); a status the server refused keeps
          // the popover, the status picked and what the user wrote, to try again.
          const set = await setOwnReviewStatus(place, review, status, { user, comment, joiningAgreed: true });
          if (set) {
            forget(draftKey);
            onDone();
          }
          return set;
        }}
      />
    </div>
  );
}
