import { TriangleAlert } from 'lucide-react';
import { Button } from '../../ui/Button';
import { confirm } from '../../ui/dialog/confirm';
import { bulkPrivateMessage, type BulkPrivate } from './bulkPrivate';
import { FILTER_LIST_FILES } from './pendingChangeOperations';
import styles from './BulkPrivateNotice.module.css';

interface BulkPrivateNoticeProps {
  bulk: BulkPrivate;
  onExclude: () => void;
  /** Adds the folder to ignore.conf, as "Ignore, cloak or hide" does for one item. */
  onIgnoreFolder: (folder: string) => void;
}

/** Above the check-in, when it would add a pile of private files: leave them out, or ignore the folder holding most. */
export function BulkPrivateNotice({ bulk, onExclude, onIgnoreFolder }: BulkPrivateNoticeProps) {
  const topFolder = bulk.folders[0];
  return (
    <div className={styles.notice} role="status">
      <TriangleAlert size={13} className={styles.icon} />
      <div className={styles.body}>
        <span className={styles.text} data-tip={bulk.folders.length > 2 ? bulk.folders.map((folder) => `${folder}/`).join('\n') : undefined}>
          {bulkPrivateMessage(bulk)}
        </span>
        <div className={styles.actions}>
          <Button size="small" onClick={onExclude}>
            Exclude private files
          </Button>
          {topFolder && (
            <Button size="small" onClick={() => onIgnoreFolder(topFolder)}>
              Add {topFolder}/ to {FILTER_LIST_FILES.ignore}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A check-in that adds a pile of private files goes ahead only once confirmed, even from the keyboard. */
export function confirmBulkPrivateCheckin(bulk: BulkPrivate): Promise<boolean> {
  return confirm({
    title: `Check in ${bulk.fileCount.toLocaleString('en-US')} private ${bulk.fileCount === 1 ? 'file' : 'files'}?`,
    message: `${bulkPrivateMessage(bulk)}. They are added to version control with this check-in; build output and generated files usually belong in ${FILTER_LIST_FILES.ignore}.`,
    confirmLabel: 'Check in anyway',
  });
}
