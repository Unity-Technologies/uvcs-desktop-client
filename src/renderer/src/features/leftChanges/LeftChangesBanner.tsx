import { Archive, FileDiff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { LeftChanges } from '@shared/domain/switchWithChanges';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { tidyMenu } from '../../lib/actions';
import { formatRelativeDate } from '../../lib/formatDate';
import { pluralize } from '../../lib/text';
import { SplitButton } from '../../ui/SplitButton';
import { discardLeftChanges, restoreLeftChanges, reviewLeftChanges } from './leftChangesOperations';
import { useLeftChanges } from './useLeftChanges';
import styles from './LeftChangesBanner.module.css';

/**
 * "Welcome back": the changes left here when switching away (or put aside to update), offered at the top of Changes.
 * One calm split button: Restore, with review and discard behind the caret.
 */
export function LeftChangesBanner() {
  const workspacePath = useWorkspacePath();
  const { data: left = [] } = useLeftChanges();
  const [busy, setBusy] = useState(false);
  const [newest, ...older] = left;
  if (!newest) return null;

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const menu = tidyMenu([
    { id: 'review', label: 'Review first', icon: FileDiff, run: () => reviewLeftChanges(newest) },
    { id: 'discard', label: 'Discard…', icon: Trash2, danger: true, run: () => void run(() => discardLeftChanges(workspacePath, [newest])) },
    older.length > 0 && {
      id: 'discardOlder',
      label: `Discard older (${older.length})`,
      icon: Trash2,
      danger: true,
      run: () => void run(() => discardLeftChanges(workspacePath, older)),
    },
  ]);

  return (
    <div className={styles.banner} role="status">
      <Archive size={16} className={styles.icon} />
      <div className={styles.text}>
        <strong className={styles.title}>{bannerTitle(newest)}</strong>
        <span className={styles.detail}>{bannerDetail(newest)}</span>
      </div>
      <SplitButton variant="primary" loading={busy} menu={menu} menuLabel="More options" onClick={() => void run(() => restoreLeftChanges(workspacePath, newest))}>
        Restore
      </SplitButton>
    </div>
  );
}

function bannerTitle(left: LeftChanges): string {
  if (left.reason === 'update') return `${pluralize(left.count, 'change')} put aside to update`;
  return left.mode === 'bring'
    ? `Your changes from ${left.sourceName} are waiting to be brought here`
    : `Welcome back — you left ${pluralize(left.count, 'change')} on ${left.sourceName}`;
}

function bannerDetail(left: LeftChanges): string {
  const shelved = `Shelved ${formatRelativeDate(left.createdAt)} (shelve ${left.shelveId})`;
  if (left.foreign) return `${shelved}, left from another workspace or app.`;
  if (left.reason === 'update') return `${shelved}: ${left.sourceName} deleted or moved ${left.count === 1 ? 'the file' : 'the files'}. Restoring merges your changes back.`;
  if (left.mode === 'bring') return `${shelved} when you switched here. Some files need your decision.`;
  return left.targetName ? `${shelved} when you switched to ${left.targetName}.` : `${shelved}.`;
}
