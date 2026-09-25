import { useState } from 'react';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { TextArea, TextField } from '../../ui/TextField';
import { switchToBranch } from './branchOperations';
import { validateBranchName } from './branchNames';

export interface NewBranchOrigin {
  /** The branch the new one hangs from, e.g. `/main`. */
  parentBranch: string;
  /** Where it starts: `cs:12` or `lb:v1`. */
  startingPoint: string;
  /** How to describe the starting point to the user, e.g. "changeset 12". */
  startingPointLabel: string;
}

export function openCreateBranchDialog(workspacePath: string, origin: NewBranchOrigin): void {
  openDialog((close) => <CreateBranchDialog workspacePath={workspacePath} origin={origin} onClose={close} />);
}

function CreateBranchDialog({ workspacePath, origin, onClose }: { workspacePath: string; origin: NewBranchOrigin; onClose: () => void }) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [topLevel, setTopLevel] = useState(false);
  const [switchAfter, setSwitchAfter] = useState(true);
  const [creating, setCreating] = useState(false);

  const fullName = topLevel ? `/${name.trim()}` : `${origin.parentBranch}/${name.trim()}`;
  const error = name ? validateBranchName(name.trim()) : undefined;

  const create = async (): Promise<void> => {
    if (!name.trim() || error) return;
    setCreating(true);
    const created = await runVoidAction(workspacePath, "Couldn't create the branch", () =>
      api.branches.create(workspacePath, { name: fullName, startingPoint: origin.startingPoint, comment }),
    );
    setCreating(false);
    if (!created) return;

    onClose();
    if (switchAfter) await switchToBranch(workspacePath, fullName);
  };

  return (
    <Dialog
      title="New branch"
      description={`Starts at ${origin.startingPointLabel}.`}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || Boolean(error)} loading={creating}>
            Create branch
          </Button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        placeholder="feature-name"
        autoFocus
        error={error}
        hint={name.trim() ? `Full name: ${fullName}` : topLevel ? 'A top-level branch, like /main.' : `A child of ${origin.parentBranch}.`}
        onChange={(event) => setName(event.target.value)}
      />
      <TextArea label="Comment" value={comment} placeholder="What is this branch for?" onChange={(event) => setComment(event.target.value)} />
      <Checkbox label="Top-level branch" checked={topLevel} onChange={setTopLevel} />
      <Checkbox label="Switch the workspace to the new branch" checked={switchAfter} onChange={setSwitchAfter} />
    </Dialog>
  );
}
