import { useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { fileNameOf, pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { describeKinds } from './changeCategories';
import { changeTone } from './changeTone';
import { suggestsBackup, UNDO_LIST_MAX, undoConsequences } from './undoPlan';
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
  const [backup, setBackup] = useState(() => suggestsBackup(changes));
  const listed = changes.slice(0, UNDO_LIST_MAX);
  const more = changes.length - listed.length;

  return (
    <Dialog
      title={changes.length === 1 ? `Undo changes to ${fileNameOf(changes[0]!.path)}?` : `Undo ${changes.length} changes?`}
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
            <StatusBadge tone={changeTone(change)} title={describeKinds(change)} />
            <PathLabel path={change.path} oldPath={change.oldPath} />
          </div>
        ))}
        {more > 0 && <div className={styles.more}>…and {more} more</div>}
      </div>
      <div className={styles.backup}>
        <Checkbox checked={backup} onChange={setBackup} label="Shelve a backup first" />
        <span className={styles.hint}>
          {backup ? 'If you need the changes back, apply the shelve from Shelves.' : 'Without a backup, this cannot be undone.'}
        </span>
      </div>
    </Dialog>
  );
}
