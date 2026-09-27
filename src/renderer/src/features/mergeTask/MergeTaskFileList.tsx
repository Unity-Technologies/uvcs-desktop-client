import type { MergePlan } from '@shared/domain/merge';
import type { ItemType } from '@shared/domain/pendingChanges';
import { ItemPathRow } from '../../components/ItemPathRow';
import type { StatusTone } from '../../components/StatusBadge';
import { mergeItemTypes } from '../merge/mergeItemTypes';
import { changeTone } from '../merge/mergeStatus';
import styles from './MergeTaskDialog.module.css';

const MAX_LISTED = 300;

interface ListedItem {
  path: string;
  oldPath?: string;
  itemType: ItemType;
  tone: StatusTone;
  title: string;
}

interface MergeTaskFileListProps {
  plan: MergePlan;
  /** Lists the files in conflict instead of the changes. */
  conflicts?: boolean;
  /** Opens a file's diff (its path without the leading slash). */
  onOpen: (path: string) => void;
}

/** The files a task merge changes, or the ones in conflict (`conflicts`); clicking one opens its diff. */
export function MergeTaskFileList({ plan, conflicts = false, onOpen }: MergeTaskFileListProps) {
  const items = conflicts ? conflictItems(plan) : changeItems(plan);
  return (
    <div className={styles.files}>
      {items.slice(0, MAX_LISTED).map((item) => (
        <button key={`${item.tone}:${item.path}`} type="button" className={styles.file} onClick={() => onOpen(item.path)} data-tip="Show the diff">
          <ItemPathRow path={item.path} itemType={item.itemType} oldPath={item.oldPath} status={{ tone: item.tone, label: item.title }} tooltip={false} />
        </button>
      ))}
      {items.length > MAX_LISTED && <div className={styles.more}>And {items.length - MAX_LISTED} more</div>}
    </div>
  );
}

const CHANGE_TITLES = { added: 'Added', changed: 'Changed', deleted: 'Deleted', moved: 'Moved', permissions: 'Only its file permissions change' };

function changeItems(plan: MergePlan): ListedItem[] {
  const typeOf = mergeItemTypes(plan.changes.map((change) => change.path));
  return plan.changes.map((change) => ({
    path: withoutRoot(change.path),
    oldPath: change.oldPath && withoutRoot(change.oldPath),
    itemType: typeOf(change.path),
    tone: changeTone(change),
    title: CHANGE_TITLES[change.kind],
  }));
}

function conflictItems(plan: MergePlan): ListedItem[] {
  return [
    ...plan.directoryConflicts.map((conflict) => ({
      path: withoutRoot(conflict.destination.path),
      itemType: conflict.isDirectory ? ('directory' as const) : ('file' as const),
      tone: 'conflict' as const,
      title: conflict.title,
    })),
    ...plan.fileConflicts.map((conflict) => ({ path: withoutRoot(conflict.path), itemType: 'file' as const, tone: 'conflict' as const, title: 'Changed on both branches' })),
  ];
}

function withoutRoot(path: string): string {
  return path.replace(/^\//, '');
}
