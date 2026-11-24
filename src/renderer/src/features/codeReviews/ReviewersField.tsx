import { Settings, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '../../ui/Avatar';
import { FilterPopover } from '../../ui/FilterPopover';
import { GroupAvatar } from '../../ui/GroupAvatar';
import { IconButton } from '../../ui/IconButton';
import { ReviewerPicker } from './conversation/ReviewerPicker';
import { focusAfterRemoving, NO_REVIEWERS, pickAsPickerOpens, pickedReviewersOf } from './pickedReviewers';
import { togglePicked, type ReviewerPick } from './reviewerPick';
import fieldStyles from '../../ui/Field.module.css';
import styles from './ReviewersField.module.css';

interface ReviewersFieldProps {
  pick: ReviewerPick;
  onPickChange: (pick: ReviewerPick) => void;
}

/**
 * Who a new review or merge request asks: the reviewers picked as chips in a box, each with its ×. The heading's
 * button, or a click on the box, opens the review page's picker (`ReviewerPicker`: the server's users and groups, read
 * once and kept) from the heading's end, where it stays put as chips are added; those picked as it opened lead its list
 * (`pickAsPickerOpens`). Remove all once there are several (`pickedReviewersOf`). A chip removed leaves the keyboard on
 * the next chip's × or on the heading's button (`focusAfterRemoving`).
 */
export function ReviewersField({ pick, onPickChange }: ReviewersFieldProps) {
  const labelId = useId();
  const { chips, removeAll, hint } = pickedReviewersOf(pick);
  const [pickerOpen, setPickerOpen] = useState(false);
  const removeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pickerRef = useRef<HTMLButtonElement>(null);
  // Where the keyboard goes once the chips are drawn again without the one removed.
  const [focusAfter, setFocusAfter] = useState<number | 'picker' | null>(null);
  useEffect(() => {
    if (focusAfter === null) return;
    (focusAfter === 'picker' ? pickerRef.current : removeRefs.current[focusAfter])?.focus();
    setFocusAfter(null);
  }, [focusAfter]);

  const openPicker = (open: boolean): void => {
    if (open) onPickChange(pickAsPickerOpens(pick));
    setPickerOpen(open);
  };
  const remove = (index: number): void => {
    onPickChange(togglePicked(pick, chips[index].member));
    setFocusAfter(focusAfterRemoving(index, chips.length));
  };
  const removeEveryone = (): void => {
    onPickChange(NO_REVIEWERS);
    setFocusAfter('picker');
  };

  return (
    <div className={fieldStyles.field} role="group" aria-labelledby={labelId}>
      <div className={styles.heading}>
        <span id={labelId} className={fieldStyles.label}>
          Reviewers
        </span>
        {removeAll && (
          <button type="button" className={styles.removeAll} onClick={removeEveryone}>
            Remove all
          </button>
        )}
        <FilterPopover
          align="end"
          open={pickerOpen}
          onOpenChange={openPicker}
          trigger={<IconButton ref={pickerRef} size="small" icon={<Settings size={14} />} label="Change reviewers" />}
        >
          <ReviewerPicker pick={pick} onPickChange={onPickChange} />
        </FilterPopover>
      </div>
      {/* A click on the box, not on a chip's ×, opens the picker too; the heading's button is the keyboard's way. */}
      <div className={styles.box} onClick={(event) => !(event.target instanceof Element && event.target.closest('button')) && openPicker(true)}>
        {hint && <span className={styles.placeholder}>Optional. You can add them later.</span>}
        {chips.map((chip, index) => (
          <span key={chip.member.name} className={styles.chip} data-tip={chip.tip}>
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
      </div>
    </div>
  );
}
