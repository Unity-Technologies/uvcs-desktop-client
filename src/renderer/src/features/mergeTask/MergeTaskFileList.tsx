import type { MergeChangeKind, MergePlan } from '@shared/domain/merge';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';
import styles from './MergeTaskDialog.module.css';

const MAX_LISTED = 300;

const CHANGE_TONES: Record<MergeChangeKind, StatusTone> = {
  added: 'added',
  changed: 'changed',
  deleted: 'deleted',
  moved: 'moved',
  permissions: 'permissions',
};

interface ListedItem {
  path: string;
  oldPath?: string;
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
          <StatusBadge tone={item.tone} title={item.title} />
          <PathLabel path={item.path} oldPath={item.oldPath} strikethrough={item.tone === 'deleted'} tooltip={false} />
        </button>
      ))}
      {items.length > MAX_LISTED && <div className={styles.more}>And {items.length - MAX_LISTED} more</div>}
    </div>
  );
}

function changeItems(plan: MergePlan): ListedItem[] {
  return plan.changes.map((change) => ({
    path: withoutRoot(change.path),
    oldPath: change.oldPath && withoutRoot(change.oldPath),
    tone: CHANGE_TONES[change.kind],
    title: change.kind,
  }));
}

function conflictItems(plan: MergePlan): ListedItem[] {
  return [
    ...plan.directoryConflicts.map((conflict) => ({ path: withoutRoot(conflict.destination.path), tone: 'conflict' as const, title: conflict.title })),
    ...plan.fileConflicts.map((conflict) => ({ path: withoutRoot(conflict.path), tone: 'conflict' as const, title: 'Changed on both branches' })),
  ];
}

function withoutRoot(path: string): string {
  return path.replace(/^\//, '');
}
