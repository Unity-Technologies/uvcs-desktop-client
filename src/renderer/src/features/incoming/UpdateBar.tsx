import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import type { ReactNode } from 'react';
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
  /** Shelves the files the branch deleted or moved, then updates. */
  onShelveBlockedAndUpdate: () => void;
  /** Resolving the conflicting files one by one in a merge tool: the offer, or the run under way. */
  run?: ReactNode;
}

/** Explains what updating will do (or what stops it) and offers to do it. */
export function UpdateBar({ incoming, pendingConflictCount, canUpdate, updating, onUpdate, onShelveBlockedAndUpdate, run }: UpdateBarProps) {
  if (incoming.blockedPaths.length > 0) {
    return (
      <div className={styles.bar} data-tone="blocked">
        <AlertTriangle size={15} className={styles.icon} />
        <span className={styles.text}>
          {incoming.branch} deleted or moved {incoming.blockedPaths.length === 1 ? 'a file' : 'files'} you changed ({incoming.blockedPaths.join(', ')}).
          Shelve {incoming.blockedPaths.length === 1 ? 'it' : 'them'} to update; you can restore your changes from Changes afterwards.
        </span>
        <Button disabled={updating} onClick={() => navigation.goToView('changes')}>
          Go to Changes
        </Button>
        <Button variant="primary" loading={updating} onClick={onShelveBlockedAndUpdate}>
          Shelve {incoming.blockedPaths.length === 1 ? 'that file' : 'those files'} and update
        </Button>
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
      {run}
      <Button variant={run && !canUpdate ? 'secondary' : 'primary'} loading={updating} disabled={!canUpdate} onClick={onUpdate}>
        {incoming.conflicts.length === 0 ? 'Update workspace' : 'Update and apply merges'}
      </Button>
    </div>
  );
}
