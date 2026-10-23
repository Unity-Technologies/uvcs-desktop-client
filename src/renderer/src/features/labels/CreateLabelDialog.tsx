import { useState } from 'react';
import { workspacePathOf, type Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByLabels } from '../../app/refresh/refreshScopes';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { TextArea, TextField } from '../../ui/TextField';
import { toast } from '../../ui/toast/toastStore';
import { validateLabelName } from './labelNames';

/**
 * Opens the "new label" dialog. Pass `changesetId` to label a specific changeset (e.g. from the changesets view);
 * otherwise the workspace's loaded changeset is labeled, which a repository with no workspace hasn't (`newLabel`).
 * Switching to the new label is offered in a workspace only.
 */
export function openCreateLabelDialog(place: Place, changesetId?: number): void {
  openDialog((close) => <CreateLabelDialog place={place} changesetId={changesetId} onClose={close} />);
}

function CreateLabelDialog({ place, changesetId, onClose }: { place: Place; changesetId?: number; onClose: () => void }) {
  const workspacePath = workspacePathOf(place);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [switchAfter, setSwitchAfter] = useState(false);
  const [creating, setCreating] = useState(false);
  const trimmed = name.trim();
  const error = validateLabelName(trimmed);

  const create = async (): Promise<void> => {
    if (!trimmed || error) return;
    setCreating(true);
    const created = await runVoidAction(place, "Couldn't create the label", () =>
      api.labels.create(place, { name: trimmed, changesetId, comment }),
      isAffectedByLabels,
    );
    setCreating(false);
    if (!created) return;

    onClose();
    toast.success(`Created label ${trimmed}`);
    if (switchAfter && workspacePath !== null) await switchWorkspace(workspacePath, `lb:${trimmed}`, `label ${trimmed}`);
  };

  return (
    <Dialog
      title="New label"
      description={changesetId === undefined ? "Labels the changeset your workspace is on." : `Labels changeset ${changesetId}.`}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!trimmed || Boolean(error)} loading={creating}>
            Create label
          </Button>
        </>
      }
    >
      <TextField label="Name" value={name} placeholder="v1.2.0" autoFocus error={error} onChange={(event) => setName(event.target.value)} />
      <TextArea label="Comment" value={comment} placeholder="Release notes, milestone…" onChange={(event) => setComment(event.target.value)} />
      {workspacePath !== null && <Checkbox label="Switch the workspace to the new label" checked={switchAfter} onChange={setSwitchAfter} />}
    </Dialog>
  );
}
