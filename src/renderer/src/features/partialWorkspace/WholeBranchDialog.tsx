import { useState } from 'react';
import type { SwitchPreflight, WholeBranchChangesAction } from '@shared/domain/switchWithChanges';
import { branchLabel } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { OptionCards } from '../../ui/OptionCards';
import { GoToChangesButton } from '../branches/GoToChangesButton';
import { PendingChangesNotes } from '../branches/PendingChangesNotes';
import { pendingChangesPronoun } from '../branches/pendingChangesWords';
import styles from '../branches/SwitchWithChangesDialog.module.css';
import { wholeBranchButton, wholeBranchCards, wholeBranchMessage, wholeBranchNotes, wholeBranchQuestion } from './wholeBranchDownload';

/** The user's go-ahead, with what happens to the pending changes when there are some to ask about. */
export interface WholeBranchConfirmation {
  pendingChanges?: WholeBranchChangesAction;
}

/**
 * Confirms downloading a partial workspace's whole branch, asking what happens to its pending changes. Resolves with
 * the go-ahead, or undefined if cancelled, including when the user goes to review the changes first.
 */
export function askWholeBranchDownload(preflight: SwitchPreflight): Promise<WholeBranchConfirmation | undefined> {
  return askDialog<WholeBranchConfirmation>((finish) => <WholeBranchDialog preflight={preflight} onFinish={finish} />);
}

function WholeBranchDialog({ preflight, onFinish }: { preflight: SwitchPreflight; onFinish: (confirmation: WholeBranchConfirmation | undefined) => void }) {
  const question = wholeBranchQuestion(preflight);
  const [action, setAction] = useState<WholeBranchChangesAction | null>(question.defaultAction);
  const cancel = (): void => onFinish(undefined);
  const submit = wholeBranchButton(action);
  const ready = !question.asksAboutChanges || action !== null;
  const confirm = (): void => {
    if (ready) onFinish(action ? { pendingChanges: action } : {});
  };

  return (
    <Dialog
      title="Download the whole branch?"
      width={480}
      onClose={cancel}
      onSubmit={confirm}
      footer={
        question.blockedByMerge ? (
          <>
            <GoToChangesButton dismiss={cancel} />
            <Button variant="primary" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {question.asksAboutChanges && <GoToChangesButton dismiss={cancel} />}
            <Button onClick={cancel}>Cancel</Button>
            <Button type="submit" variant={submit.variant} disabled={!ready} autoFocus>
              {submit.label}
            </Button>
          </>
        )
      }
    >
      <p className={styles.question}>{wholeBranchMessage(branchLabel(preflight.sourceName))}</p>
      {question.asksAboutChanges && (
        <>
          <p className={styles.question}>
            You have {pluralize(preflight.pendingCount, 'pending change')}. What should happen to {pendingChangesPronoun(preflight.pendingCount)}?
          </p>
          <OptionCards label="Your pending changes" cards={wholeBranchCards(preflight.pendingCount)} value={action} onChange={setAction} />
        </>
      )}
      {question.blockedByMerge && <p className={styles.blocker}>You’re in the middle of a merge. Check it in or undo it before downloading the whole branch.</p>}
      {!question.blockedByMerge && <PendingChangesNotes notes={wholeBranchNotes(preflight, action)} />}
    </Dialog>
  );
}
