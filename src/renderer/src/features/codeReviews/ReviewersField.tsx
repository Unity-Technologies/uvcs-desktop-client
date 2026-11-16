import { UserPlus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { FilterPopover } from '../../ui/FilterPopover';
import { GroupAvatar } from '../../ui/GroupAvatar';
import { IconButton } from '../../ui/IconButton';
import { ReviewerPicker } from './conversation/ReviewerPicker';
import { focusAfterRemoving, NO_REVIEWERS, pickedReviewersOf } from './pickedReviewers';
import { togglePicked, type ReviewerPick } from './reviewerPick';
import fieldStyles from '../../ui/Field.module.css';
import styles from './ReviewersField.module.css';

interface ReviewersFieldProps {
  pick: ReviewerPick;
  onPickChange: (pick: ReviewerPick) => void;
}

/**
 * Who a new review or merge request asks: the reviewers picked as chips, each with its ×, and Add, which opens the
 * review page's picker (`ReviewerPicker`: the server's users and groups, read once and kept). Remove all once there
 * are several (`pickedReviewersOf`). A chip removed leaves the keyboard on the next chip's × or on Add
 * (`focusAfterRemoving`).
 */
export function ReviewersField({ pick, onPickChange }: ReviewersFieldProps) {
  const labelId = useId();
  const { chips, removeAll, hint } = pickedReviewersOf(pick);
  const removeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);
  // Where the keyboard goes once the chips are drawn again without the one removed.
  const [focusAfter, setFocusAfter] = useState<number | 'add' | null>(null);
  useEffect(() => {
    if (focusAfter === null) return;
    (focusAfter === 'add' ? addRef.current : removeRefs.current[focusAfter])?.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  const remove = (index: number): void => {
    onPickChange(togglePicked(pick, chips[index].member));
    setFocusAfter(focusAfterRemoving(index, chips.length));
  };
  const removeEveryone = (): void => {
    onPickChange(NO_REVIEWERS);
    setFocusAfter('add');
  };

  return (
    <div className={fieldStyles.field} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={fieldStyles.label}>
        Reviewers
      </span>
      <div className={styles.row}>
        {chips.map((chip, index) => (
          <span key={chip.member.name} className={styles.chip}>
            {chip.group ? <GroupAvatar size={16} /> : <Avatar user={chip.member.name} size={16} tip={null} />}
            <span className={styles.name}>
              {chip.label}
              {chip.group && <span className="visually-hidden"> (group)</span>}
            </span>
            <IconButton
              ref={(element) => {
                removeRefs.current[index] = element;
              }}
              size="small"
              className={styles.remove}
              icon={<X size={12} />}
              label={`Remove ${chip.label}`}
              onClick={() => remove(index)}
            />
          </span>
        ))}
        <FilterPopover
          trigger={
            <Button ref={addRef} size="small" icon={<UserPlus size={14} />}>
              Add
            </Button>
          }
        >
          <ReviewerPicker pick={pick} onPickChange={onPickChange} />
        </FilterPopover>
        {removeAll && (
          <button type="button" className={styles.removeAll} onClick={removeEveryone}>
            Remove all
          </button>
        )}
      </div>
      {hint && <span className={fieldStyles.hint}>Optional. You can add them later.</span>}
    </div>
  );
}
