import { FolderOpen } from 'lucide-react';
import { useState } from 'react';
import type { MergeTool } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { formatArgs, parseArgs } from '../../../lib/argumentLine';
import { PROGRAM_PLACEHOLDER } from '../../../lib/platform';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { askDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { programName } from './programName';
import { addCustomMergeTool } from './useMergeTools';
import styles from './CustomMergeToolDialog.module.css';

/** The order most three-way tools take: base, yours, incoming, and where to save. */
const DEFAULT_ARGS = ['{base}', '{yours}', '{incoming}', '{result}'];

export const PLACEHOLDER_HINT = '{base} {yours} {incoming} and {result}, where the tool saves; {baseName} {yoursName} {incomingName} name them.';

/** Asks for a merge app to add; it becomes the preferred one. The tool, or undefined if cancelled. */
export async function addMergeToolAndPick(): Promise<MergeTool | undefined> {
  const id = await askDialog<string>((finish) => <CustomMergeToolDialog finish={finish} />);
  if (!id) return undefined;
  return (await api.mergeTools.list()).tools.find((tool) => tool.id === id);
}

function CustomMergeToolDialog({ finish }: { finish: (id: string | undefined) => void }) {
  const [executable, setExecutable] = useState('');
  const [name, setName] = useState('');
  const [args, setArgs] = useState(formatArgs(DEFAULT_ARGS));
  const parsedArgs = parseArgs(args);
  const argsError = parsedArgs.some((arg) => arg.includes('{result}')) ? undefined : 'Include {result}: the file the tool saves the merge to.';
  const [saving, setSaving] = useState(false);
  const canSave = executable.trim() !== '' && !argsError && !saving;

  const choose = async (): Promise<void> => {
    const picked = await api.mergeTools.pickProgram();
    if (!picked) return;
    setExecutable(picked);
    if (!name) setName(programName(picked));
  };
  const save = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    const id = await addCustomMergeTool({ name: name.trim() || programName(executable), executable: executable.trim(), args: parsedArgs });
    // Not saved: the toast says so, and the dialog stays with what the user typed, to try again or cancel.
    if (id) finish(id);
    else setSaving(false);
  };

  return (
    <Dialog
      title="Add a merge app"
      description="It opens a conflicting file's three versions only when you ask, and the file takes what you save there."
      width={520}
      onClose={() => finish(undefined)}
      onSubmit={() => void save()}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canSave}>
            Add and use
          </Button>
        </>
      }
    >
      <div className={styles.programRow}>
        <TextField label="Program" value={executable} placeholder={PROGRAM_PLACEHOLDER} onChange={(event) => setExecutable(event.target.value)} autoFocus />
        <Button icon={<FolderOpen size={13} />} onClick={() => void choose()}>
          Choose…
        </Button>
      </div>
      <TextField label="Name" value={name} placeholder={executable ? programName(executable) : 'My merge tool'} onChange={(event) => setName(event.target.value)} />
      <TextField label="Arguments" value={args} error={argsError} hint={PLACEHOLDER_HINT} onChange={(event) => setArgs(event.target.value)} className={styles.args} />
    </Dialog>
  );
}
