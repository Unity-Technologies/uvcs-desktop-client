import { useState } from 'react';
import type { SwitchChangesAction, SwitchPreflight } from '@shared/domain/switchWithChanges';
import { branchLabels } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { PendingChangesChoice } from './PendingChangesChoice';
import { PendingChangesNotes } from './PendingChangesNotes';
import { pendingChangesPronoun } from './pendingChangesWords';
import { GoToChangesButton } from './GoToChangesButton';
import { switchButton, switchNotes, type SwitchChoice } from './switchOptions';
import styles from './SwitchWithChangesDialog.module.css';

interface SwitchWithChangesRequest {
  /** Where the workspace is going, e.g. `/main/t2`. */
  targetName: string;
  preflight: SwitchPreflight;
  choice: SwitchChoice;
  inMerge: boolean;
}

/**
 * Asks what happens to the pending changes before switching. Resolves with the choice, or undefined if cancelled,
 * including when the user goes to review the changes first.
 */
export function askSwitchWithChanges(request: SwitchWithChangesRequest): Promise<SwitchChangesAction | undefined> {
  return askDialog<SwitchChangesAction>((finish) => <SwitchWithChangesDialog {...request} onFinish={finish} />);
}

function SwitchWithChangesDialog({
  targetName,
  preflight,
  choice,
  inMerge,
  onFinish,
}: SwitchWithChangesRequest & { onFinish: (action: SwitchChangesAction | undefined) => void }) {
  const [action, setAction] = useState<SwitchChangesAction | null>(choice.defaultAction);
  const cancel = (): void => onFinish(undefined);
  const submit = switchButton(action);
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
            <GoToChangesButton dismiss={cancel} />
            <Button variant="primary" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <GoToChangesButton dismiss={cancel} />
            <Button onClick={cancel}>Cancel</Button>
            <Button type="submit" variant={submit.variant} disabled={!action} autoFocus>
              {submit.label}
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
      {!inMerge && <PendingChangesNotes notes={switchNotes(preflight, action)} />}
    </Dialog>
  );
}
