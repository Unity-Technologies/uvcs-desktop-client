import { Archive, FileDiff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { SEPARATOR, tidyMenu } from '../../lib/actions';
import { SplitButton } from '../../ui/SplitButton';
import { discardLeftChanges, restoreLeftChanges, reviewLeftChanges } from './leftChangesOperations';
import { leftChangesDetail, leftChangesTitle } from './leftChangesWords';
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
    SEPARATOR,
    { id: 'discard', label: 'Discard…', icon: Trash2, danger: true, run: () => void run(() => discardLeftChanges(workspacePath, [newest])) },
    older.length > 0 && {
      id: 'discardOlder',
      label: `Discard older (${older.length})…`,
      icon: Trash2,
      danger: true,
      run: () => void run(() => discardLeftChanges(workspacePath, older)),
    },
  ]);

  return (
    <div className={styles.banner} role="status">
      <Archive size={16} className={styles.icon} />
      <div className={styles.text}>
        <strong className={styles.title}>{leftChangesTitle(newest)}</strong>
        <span className={styles.detail}>{leftChangesDetail(newest)}</span>
      </div>
      <SplitButton variant="primary" loading={busy} menu={menu} menuLabel="More options" onClick={() => void run(() => restoreLeftChanges(workspacePath, newest))}>
        Restore
      </SplitButton>
    </div>
  );
}
