import { useState } from 'react';
import type { PendingChangesAction, SwitchPreflight } from '@shared/domain/switchWithChanges';
import { navigation } from '../../app/navigation/navigationStore';
import { branchLabels } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { PendingChangesChoice } from './PendingChangesChoice';
import { pendingChangesPronoun } from './pendingChangesWords';
import type { SwitchChoice } from './switchOptions';
import styles from './SwitchWithChangesDialog.module.css';

interface SwitchWithChangesRequest {
  /** Where the workspace is going, e.g. `/main/t2`. */
  targetName: string;
  preflight: SwitchPreflight;
  choice: SwitchChoice;
  inMerge: boolean;
}

/** Asks what happens to the pending changes before switching. Resolves with the choice, or undefined if cancelled. */
export function askSwitchWithChanges(request: SwitchWithChangesRequest): Promise<PendingChangesAction | undefined> {
  return askDialog<PendingChangesAction>((finish) => <SwitchWithChangesDialog {...request} onFinish={finish} />);
}

function SwitchWithChangesDialog({
  targetName,
  preflight,
  choice,
  inMerge,
  onFinish,
}: SwitchWithChangesRequest & { onFinish: (action: PendingChangesAction | undefined) => void }) {
  const [action, setAction] = useState(choice.defaultAction);
  const cancel = (): void => onFinish(undefined);
  const [sourceName] = branchLabels(preflight.sourceName, targetName);

  return (
    <Dialog
      title={`Switch to ${targetName}`}
      width={480}
      onClose={cancel}
      onSubmit={() => action && onFinish(action)}
      footer={
        inMerge ? (
          <>
            <Button
              onClick={() => {
                cancel();
                navigation.goToView('changes');
              }}
            >
              Review changes
            </Button>
            <Button variant="primary" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={cancel}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!action} autoFocus>
              Switch
            </Button>
          </>
        )
      }
    >
      <p className={styles.question}>
        You have {pluralize(preflight.pendingCount, 'pending change')} on <code data-tip={preflight.sourceName}>{sourceName}</code>. What should happen to {pendingChangesPronoun(preflight.pendingCount)}?
      </p>
      <PendingChangesChoice source={preflight.sourceName} destination={targetName} choice={choice} count={preflight.pendingCount} value={action} onChange={setAction} />
      {inMerge && <p className={styles.blocker}>You’re in the middle of a merge. Check it in or undo it before switching.</p>}
      {!inMerge && choice.notes.length > 0 && (
        <ul className={styles.notes}>
          {choice.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
