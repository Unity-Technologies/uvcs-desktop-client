import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { TextField } from '../../ui/TextField';
import { parseBranchList } from './pathPermissionOperations';

const BRANCHES_HINT = 'Full names, apart by commas: /main, /main/release';

/**
 * Asks which branches to add to a path's group of branches and which to take out. `cm` can't list a group's branches,
 * so the ones it has aren't shown: those not named stay as they are.
 */
export function askPathBranchEdits(tag: string): Promise<{ add: string[]; remove: string[] } | undefined> {
  return askDialog<{ add: string[]; remove: string[] }>((finish) => <EditPathBranchesDialog tag={tag} finish={finish} />);
}

function EditPathBranchesDialog({ tag, finish }: { tag: string; finish: (edits: { add: string[]; remove: string[] } | undefined) => void }) {
  const [add, setAdd] = useState('');
  const [remove, setRemove] = useState('');
  const edits = { add: parseBranchList(add), remove: parseBranchList(remove) };
  const empty = edits.add.length === 0 && edits.remove.length === 0;

  return (
    <Dialog
      title={`Branches of ${tag}`}
      description="Add branches to the group or take some out; the others stay as they are."
      width={500}
      onClose={() => finish(undefined)}
      onSubmit={() => !empty && finish(edits)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={empty}>
            Change branches
          </Button>
        </>
      }
    >
      <TextField label="Add" value={add} autoFocus hint={BRANCHES_HINT} onChange={(event) => setAdd(event.target.value)} />
      <TextField label="Take out" value={remove} hint={BRANCHES_HINT} onChange={(event) => setRemove(event.target.value)} />
    </Dialog>
  );
}
