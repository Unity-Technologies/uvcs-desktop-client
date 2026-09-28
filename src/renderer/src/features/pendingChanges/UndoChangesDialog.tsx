import { useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { ItemPathRow } from '../../components/ItemPathRow';
import { fileNameOf, formatCount, pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { changePresence, changeStatus } from './changeTone';
import { offersBackup, UNDO_LIST_MAX, undoConsequences } from './undoPlan';
import styles from './UndoChangesDialog.module.css';

export interface UndoAnswer {
  /** Shelve the changes before undoing them. */
  backup: boolean;
}

/** Asks before undoing `changes`: lists them, says what undoing each kind does, and offers to shelve a backup first. */
export function askUndoChanges(changes: PendingChange[]): Promise<UndoAnswer | undefined> {
  return askDialog<UndoAnswer>((finish) => <UndoChangesDialog changes={changes} finish={finish} />);
}

function UndoChangesDialog({ changes, finish }: { changes: PendingChange[]; finish: (answer: UndoAnswer | undefined) => void }) {
  const canBackup = offersBackup(changes);
  const [backup, setBackup] = useState(false);
  const listed = changes.slice(0, UNDO_LIST_MAX);
  const more = changes.length - listed.length;

  return (
    <Dialog
      title={changes.length === 1 ? `Undo changes to ${fileNameOf(changes[0]!.path)}?` : `Undo ${formatCount(changes.length)} changes?`}
      width={540}
      onClose={() => finish(undefined)}
      onSubmit={() => finish({ backup })}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="danger" autoFocus>
            {changes.length === 1 ? 'Undo changes' : `Undo ${pluralize(changes.length, 'change')}`}
          </Button>
        </>
      }
    >
      <ul className={styles.consequences}>
        {undoConsequences(changes).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className={styles.files}>
        {listed.map((change) => (
          <div key={change.path} className={styles.file}>
            <ItemPathRow path={change.path} itemType={change.itemType} oldPath={change.oldPath} status={changeStatus(change)} presence={changePresence(change)} />
          </div>
        ))}
        {more > 0 && <div className={styles.more}>…and {formatCount(more)} more</div>}
      </div>
      {canBackup && (
        <div className={styles.backup}>
          <Checkbox checked={backup} onChange={setBackup} label="Shelve a backup first" />
          <span className={styles.hint}>
            {backup ? 'If you need the changes back, apply the shelve from your shelves in Changes.' : 'Without a backup, this cannot be undone.'}
          </span>
        </div>
      )}
    </Dialog>
  );
}
