import { useState } from 'react';
import type { Place } from '@shared/domain/place';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { commentPlaceholder } from '../../components/commentEditor/commentPlaceholders';
import { TextField } from '../../ui/TextField';
import { validateLabelName } from './labelNames';
import { createLabel, offersSwitchToNewLabel } from './createLabel';

/**
 * Opens the "new label" dialog. Pass `changesetId` to label a specific changeset (e.g. from the changesets view);
 * otherwise the workspace's loaded changeset is labeled, which a repository with no workspace hasn't (`newLabel`).
 * Switching to the new label is offered in a workspace only (`offersSwitchToNewLabel`).
 */
export function openCreateLabelDialog(place: Place, changesetId?: number): void {
  openDialog((close) => <CreateLabelDialog place={place} changesetId={changesetId} onClose={close} />);
}

function CreateLabelDialog({ place, changesetId, onClose }: { place: Place; changesetId?: number; onClose: () => void }) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [switchAfter, setSwitchAfter] = useState(false);
  const [creating, setCreating] = useState(false);
  const trimmed = name.trim();
  const error = validateLabelName(trimmed);

  const create = async (): Promise<void> => {
    if (!trimmed || error) return;
    setCreating(true);
    await createLabel(place, { name: trimmed, changesetId, comment: comment.trim() }, { switchAfter, onCreated: onClose });
    setCreating(false);
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
      <CommentArea label="Comment" value={comment} placeholder={commentPlaceholder('Release notes, milestone…')} onChange={setComment} />
      {offersSwitchToNewLabel(place) && <Checkbox label="Switch the workspace to the new label" checked={switchAfter} onChange={setSwitchAfter} />}
    </Dialog>
  );
}
