import { useState } from 'react';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { TextArea, TextField } from '../../ui/TextField';

export function openCreateAttributeDialog(workspacePath: string): void {
  openDialog((close) => <CreateAttributeDialog workspacePath={workspacePath} onClose={close} />);
}

function CreateAttributeDialog({ workspacePath, onClose }: { workspacePath: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [creating, setCreating] = useState(false);
  const trimmed = name.trim();
  const error = /\s/.test(trimmed) ? 'Attribute names cannot contain spaces.' : undefined;

  const create = async (): Promise<void> => {
    if (!trimmed || error) return;
    setCreating(true);
    const created = await runVoidAction(workspacePath, "Couldn't create the attribute", () => api.attributes.createType(workspacePath, trimmed, comment.trim()));
    setCreating(false);
    if (created) onClose();
  };

  return (
    <Dialog
      title="New attribute"
      description="Attributes add your own fields to branches, changesets and labels, like a status or a reviewer."
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!trimmed || Boolean(error)} loading={creating}>
            Create attribute
          </Button>
        </>
      }
    >
      <TextField label="Name" value={name} placeholder="status" autoFocus error={error} onChange={(event) => setName(event.target.value)} />
      <TextArea label="Comment" value={comment} placeholder="What the attribute means and its expected values" onChange={(event) => setComment(event.target.value)} />
    </Dialog>
  );
}
