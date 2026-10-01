import { ChevronRight, ListChecks, MoreHorizontal } from 'lucide-react';
import { memo } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { ItemIcon } from '../../components/ItemIcon';
import { ItemPathRow } from '../../components/ItemPathRow';
import { ItemRow } from '../../components/ItemRow';
import { ItemStatusMark } from '../../components/ItemStatusMark';
import { ItemTag } from '../../components/ItemTag';
import type { MenuEntry } from '../../lib/actions';
import { Checkbox, type CheckState } from '../../ui/Checkbox';
import { Highlight } from '../../ui/Highlight';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { ReviewStatus } from '../review/reviewStatus';
import { ReviewToggle } from '../review/ReviewToggle';
import { changePresence, changeStatus, changeTone } from './changeTone';
import type { ChangeRow } from './changeRows';
import { LockMark } from './locks/LockMark';
import type { PendingLock } from './locks/pendingLocks';
import styles from './ChangesList.module.css';

/** Checks or unchecks what the rows stand for, all at once. */
export type ToggleIncluded = (rows: ChangeRow[], included: boolean) => void;

/** What a row of a file or folder does, stable across renders. */
export interface RowActions {
  toggleIncluded: ToggleIncluded;
  toggleReviewed: (changes: PendingChange[]) => void;
}

type GroupRow = ChangeRow & { type: 'group' };

interface GroupRowContentProps {
  row: GroupRow;
  checkState: CheckState | null;
  onToggleIncluded: ToggleIncluded;
  changelistMenu: (changelist: Changelist) => MenuEntry[];
}

/** A changelist's header: its check, icon, name, actions and count. The icon, as in the official client, sets it apart from the folders under it. */
export function GroupRowContent({ row, checkState, onToggleIncluded, changelistMenu }: GroupRowContentProps) {
  return (
    <>
      <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
      <RowCheckbox row={row} checkState={checkState} label={row.label} onToggleIncluded={onToggleIncluded} />
      <ListChecks size={14} className={styles.groupIcon} aria-hidden />
      <span className={styles.groupLabel} data-tip={row.changelist?.description}>
        {row.label}
      </span>
      {row.changelist && (
        <ActionDropdownMenu entries={changelistMenu(row.changelist)}>
          <button className={styles.groupMenu} onMouseDown={(event) => event.stopPropagation()} aria-label="Changelist actions">
            <MoreHorizontal size={14} />
          </button>
        </ActionDropdownMenu>
      )}
      <span className={styles.count}>{row.changes.length}</span>
    </>
  );
}

interface ItemRowContentProps {
  row: Exclude<ChangeRow, GroupRow>;
  /** Null when nothing it stands for can be checked in. */
  checkState: CheckState | null;
  /** Null outside review mode. */
  reviewStatus: ReviewStatus | null;
  lock?: PendingLock;
  actions: RowActions;
}

/** A file or folder as every list shows one (`ItemRow`), after its check (and a folder's chevron). */
export const ItemRowContent = memo(function ItemRowContent({ row, checkState, reviewStatus, lock, actions }: ItemRowContentProps) {
  if (row.type === 'directory') {
    return (
      <>
        <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
        <RowCheckbox row={row} checkState={checkState} label={row.name} onToggleIncluded={actions.toggleIncluded} />
        {/* Every folder here holds changes, so only its own change marks it. */}
        <ItemRow
          icon={<ItemIcon itemType="directory" name={row.name} />}
          label={
            <span className={styles.directoryName} data-tip={row.name.includes('/') ? row.name : undefined}>
              <Highlight text={row.name} />
            </span>
          }
          extras={reviewStatus && <ReviewToggle folder status={reviewStatus} onToggle={() => actions.toggleReviewed(row.changes)} />}
          status={<ItemStatusMark status={row.change && changeStatus(row.change)} />}
          presence={row.change ? changePresence(row.change) : 'controlled'}
          deleted={row.change && changeTone(row.change) === 'deleted'}
          faded={reviewStatus === 'reviewed'}
        />
      </>
    );
  }
  const { change } = row;
  return (
    <>
      {checkState !== null ? (
        <Checkbox checked={checkState} onChange={(checked) => actions.toggleIncluded([row], checked)} ariaLabel="Include in the check in" focusable={false} />
      ) : (
        <span className={styles.checkboxPlaceholder} />
      )}
      <ItemPathRow
        path={change.path}
        itemType={change.itemType}
        nameOnly={row.depth > 0}
        oldPath={change.oldPath}
        status={changeStatus(change)}
        presence={changePresence(change)}
        faded={reviewStatus === 'reviewed'}
        extras={
          <>
            {change.mergeInfo && <ItemTag>{change.mergeInfo}</ItemTag>}
            {reviewStatus && <ReviewToggle status={reviewStatus} onToggle={() => actions.toggleReviewed([change])} />}
            {lock && <LockMark lock={lock} />}
          </>
        }
      />
    </>
  );
});

/** A changelist's or folder's checkbox, or its room when nothing in it can be checked in. */
function RowCheckbox({ row, checkState, label, onToggleIncluded }: { row: ChangeRow; checkState: CheckState | null; label: string; onToggleIncluded: ToggleIncluded }) {
  if (checkState === null) return <span className={styles.checkboxPlaceholder} />;
  return <Checkbox checked={checkState} onChange={(checked) => onToggleIncluded([row], checked)} ariaLabel={`Include ${label}`} focusable={false} />;
}
