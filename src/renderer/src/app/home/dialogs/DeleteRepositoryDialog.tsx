import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { TextField } from '../../../ui/TextField';

interface DeleteRepositoryDialogProps {
  repository: RepositorySummary;
  finish: (confirmed: true | undefined) => void;
}

/** Deleting a repository destroys its whole history, so the user must type its name to confirm. */
export function DeleteRepositoryDialog({ repository, finish }: DeleteRepositoryDialogProps) {
  const [typedName, setTypedName] = useState('');
  const matches = typedName === repository.name;

  return (
    <Dialog
      title={`Delete ${repository.name}?`}
      description={`Every branch, changeset and label in ${repository.spec} is deleted for everyone. This cannot be undone.`}
      onClose={() => finish(undefined)}
      onSubmit={() => matches && finish(true)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={!matches}>
            Delete repository
          </Button>
        </>
      }
    >
      <TextField
        label={`Type ${repository.name} to confirm`}
        value={typedName}
        onChange={(event) => setTypedName(event.target.value)}
        autoFocus
      />
    </Dialog>
  );
}
