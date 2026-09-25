import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import type { IncomingChanges } from '@shared/domain/incoming';
import { navigation } from '../../app/navigation/navigationStore';
import { Button } from '../../ui/Button';
import styles from './UpdateBar.module.css';

interface UpdateBarProps {
  incoming: IncomingChanges;
  pendingConflictCount: number;
  canUpdate: boolean;
  updating: boolean;
  onUpdate: () => void;
}

/** Explains what updating will do (or what stops it) and offers to do it. */
export function UpdateBar({ incoming, pendingConflictCount, canUpdate, updating, onUpdate }: UpdateBarProps) {
  if (incoming.blockedPaths.length > 0) {
    return (
      <div className={styles.bar} data-tone="blocked">
        <AlertTriangle size={15} className={styles.icon} />
        <span className={styles.text}>
          {incoming.branch} deleted or moved files you changed locally ({incoming.blockedPaths.join(', ')}). Check in, shelve or undo those
          changes before updating.
        </span>
        <Button onClick={() => navigation.goToView('changes')}>Go to Changes</Button>
      </div>
    );
  }

  const newChangesets = `${incoming.changesetCount} new ${incoming.changesetCount === 1 ? 'changeset' : 'changesets'}`;
  const message =
    incoming.conflicts.length === 0
      ? `Update to get ${newChangesets}. Your local changes stay as they are.`
      : pendingConflictCount > 0
        ? `${incoming.conflicts.length} of your changed files also changed on ${incoming.branch}. Merge them to update.`
        : 'All the files are merged. Update to apply the result.';

  return (
    <div className={styles.bar}>
      <ArrowDownToLine size={15} className={styles.icon} />
      <span className={styles.text}>{message}</span>
      <Button variant="primary" loading={updating} disabled={!canUpdate} onClick={onUpdate}>
        {incoming.conflicts.length === 0 ? 'Update workspace' : 'Update and apply merges'}
      </Button>
    </div>
  );
}
