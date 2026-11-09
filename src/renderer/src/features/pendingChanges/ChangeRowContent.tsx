import { ChevronRight, ClipboardList, MoreHorizontal } from 'lucide-react';
import { memo } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { ItemPathRow } from '../../components/ItemPathRow';
import { ItemTag } from '../../components/ItemTag';
import { MetaTag } from '../../components/MetaTag';
import { StatusGroupBadge } from '../../components/StatusBadge';
import { TreeFolderLabel } from '../../components/TreeFolderLabel';
import type { MenuEntry } from '../../lib/actions';
import { itemsIn, rangeLength } from '../../lib/itemRange';
import { folderItemCount } from '../../lib/pathTree';
import { Checkbox, type CheckState } from '../../ui/Checkbox';
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
  changelistMenu: (changelist: Changelist | null) => MenuEntry[];
  /** Whether it has a menu, and so a "…" (`changelistHasMenu`): cheap, unlike building the menu. */
  hasChangelistMenu: (changelist: Changelist | null) => boolean;
}

/**
 * A changelist's or a status group's header: its check, icon, name, actions and count. A changelist's icon, as in the
 * official client, sets it apart from the folders under it; a status group's is its status letter, as its rows have it.
 * Every changelist has its "…", the default one too, unless nothing in its menu applies; the menu is built only when it
 * opens. A status group has none: right-clicking it opens its changes' menu.
 */
export function GroupRowContent({ row, checkState, onToggleIncluded, changelistMenu, hasChangelistMenu }: GroupRowContentProps) {
  // The changelist the header is, null for the default one; undefined for a status group.
  const changelist = row.group.kind === 'changelist' ? (row.group.changelist ?? null) : undefined;
  return (
    <>
      <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
      <RowCheckbox row={row} checkState={checkState} label={row.label} onToggleIncluded={onToggleIncluded} />
      {row.group.kind === 'status' ? (
        <StatusGroupBadge tone={row.group.tone} />
      ) : (
        <ClipboardList size={14} className={styles.groupIcon} aria-hidden />
      )}
      <span className={styles.groupLabel} data-tip={changelist?.description}>
        {row.label}
      </span>
      {changelist !== undefined && hasChangelistMenu(changelist) && (
        <ActionDropdownMenu entries={() => changelistMenu(changelist)}>
          <button className={styles.groupMenu} onMouseDown={(event) => event.stopPropagation()} aria-label="Changelist actions">
            <MoreHorizontal size={14} />
          </button>
        </ActionDropdownMenu>
      )}
      <span className={styles.count}>{rangeLength(row.held)}</span>
    </>
  );
}

interface ItemRowContentProps {
  row: Exclude<ChangeRow, GroupRow>;
  /** Null when nothing it stands for can be checked in. */
  checkState: CheckState | null;
  /** Null outside review mode. */
  reviewStatus: ReviewStatus | null;
  /** A folder's review while under way ("2/5", `partialReviewCount`). */
  reviewPartial?: string | null;
  lock?: PendingLock;
  /** Its Unity `.meta` changed too, and rides on its row. */
  hasMeta?: boolean;
  actions: RowActions;
}

/** A file or folder as every list shows one (`ItemRow`), after its check (and a folder's chevron). */
export const ItemRowContent = memo(function ItemRowContent({ row, checkState, reviewStatus, reviewPartial, lock, hasMeta, actions }: ItemRowContentProps) {
  if (row.type === 'folder') {
    return (
      <TreeFolderLabel
        name={row.name}
        collapsed={row.collapsed}
        count={folderItemCount(row)}
        before={<RowCheckbox row={row} checkState={checkState} label={row.name} onToggleIncluded={actions.toggleIncluded} />}
        extras={
          <>
            {hasMeta && <MetaTag takenAlong />}
            {reviewStatus && <ReviewToggle folder status={reviewStatus} partial={reviewPartial} onToggle={() => actions.toggleReviewed(itemsIn(row.held))} />}
          </>
        }
        status={row.item && changeStatus(row.item)}
        presence={row.item ? changePresence(row.item) : 'controlled'}
        deleted={row.item && changeTone(row.item) === 'deleted'}
        faded={reviewStatus === 'reviewed'}
      />
    );
  }
  const { item: change } = row;
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
            {hasMeta && <MetaTag takenAlong />}
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
