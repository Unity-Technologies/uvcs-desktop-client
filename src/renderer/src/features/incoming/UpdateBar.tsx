import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import type { ReactNode } from 'react';
import type { IncomingChanges } from '@shared/domain/incoming';
import { navigation } from '../../app/navigation/navigationStore';
import { Button } from '../../ui/Button';
import { blockedMessage, updateBarMessage } from './collisionMessages';
import styles from './UpdateBar.module.css';

interface UpdateBarProps {
  incoming: IncomingChanges;
  pendingConflictCount: number;
  canUpdate: boolean;
  updating: boolean;
  onUpdate: () => void;
  /** Shelves the files the branch deleted or moved, then updates unless files still need merging. */
  onShelveBlockedAndUpdate: () => void;
  /** Resolving the conflicting files one by one in a merge tool: the offer, or the run under way. */
  run?: ReactNode;
}

/** Explains what updating will do (or what stops it) and offers to do it. */
export function UpdateBar({ incoming, pendingConflictCount, canUpdate, updating, onUpdate, onShelveBlockedAndUpdate, run }: UpdateBarProps) {
  const branch = incoming.branch ?? '';
  if (incoming.blockedPaths.length > 0) {
    return (
      <div className={styles.bar} data-tone="blocked">
        <AlertTriangle size={15} className={styles.icon} />
        <span className={styles.text}>{blockedMessage(incoming.blockedPaths.length, branch, pendingConflictCount)}</span>
        <Button disabled={updating} onClick={() => navigation.goToView('changes')}>
          Go to Changes
        </Button>
        <Button
          variant="primary"
          loading={updating}
          data-tip={`Shelves your changes to these files${pendingConflictCount > 0 ? '' : ', then updates'}. Changes offers them back.`}
          onClick={onShelveBlockedAndUpdate}
        >
          {`Shelve ${incoming.blockedPaths.length === 1 ? 'it' : 'them'}${pendingConflictCount > 0 ? '' : ' and update'}`}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <ArrowDownToLine size={15} className={styles.icon} />
      <span className={styles.text}>{updateBarMessage(incoming.changesetCount, branch, incoming.conflicts.length, pendingConflictCount)}</span>
      {run}
      <Button variant={run && !canUpdate ? 'secondary' : 'primary'} loading={updating} disabled={!canUpdate} onClick={onUpdate}>
        {incoming.conflicts.length === 0 ? 'Update workspace' : 'Update and apply merges'}
      </Button>
    </div>
  );
}
