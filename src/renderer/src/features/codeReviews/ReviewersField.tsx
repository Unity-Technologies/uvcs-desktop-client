import { UserPlus, X } from 'lucide-react';
import { useId } from 'react';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { FilterPopover } from '../../ui/FilterPopover';
import { GroupAvatar } from '../../ui/GroupAvatar';
import { ReviewerPicker } from './conversation/ReviewerPicker';
import { NO_REVIEWERS, pickedReviewersOf } from './pickedReviewers';
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
 * are several (`pickedReviewersOf`).
 */
export function ReviewersField({ pick, onPickChange }: ReviewersFieldProps) {
  const labelId = useId();
  const { chips, removeAll } = pickedReviewersOf(pick);

  return (
    <div className={fieldStyles.field} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={fieldStyles.label}>
        Reviewers
      </span>
      <div className={styles.row}>
        {chips.map((chip) => (
          <span key={chip.name} className={styles.chip}>
            {chip.group ? <GroupAvatar size={16} /> : <Avatar user={chip.name} size={16} tip={null} />}
            <span className={styles.name}>
              {chip.label}
              {chip.group && <span className="visually-hidden"> (group)</span>}
            </span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${chip.label}`}
              onClick={() => onPickChange(togglePicked(pick, { name: chip.name, kind: chip.group ? 'group' : 'user' }))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <FilterPopover trigger={<Button size="small" icon={<UserPlus size={14} />}>Add</Button>}>
          <ReviewerPicker pick={pick} onPickChange={onPickChange} />
        </FilterPopover>
        {removeAll && (
          <button type="button" className={styles.removeAll} onClick={() => onPickChange(NO_REVIEWERS)}>
            Remove all
          </button>
        )}
      </div>
      {chips.length === 0 && <span className={fieldStyles.hint}>Optional. You can add them later.</span>}
    </div>
  );
}
