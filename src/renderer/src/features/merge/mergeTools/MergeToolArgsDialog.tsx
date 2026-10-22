import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MergeTool } from '@shared/domain/mergeTools';
import { formatArgs, parseArgs } from '../../../lib/argumentLine';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { PLACEHOLDER_HINT } from './CustomMergeToolDialog';
import { hasOwnArgsToGoBackTo, mergeToolArgsProblem } from './mergeToolArgs';
import { removeCustomMergeTool, setMergeToolArgs } from './useMergeTools';
import styles from './CustomMergeToolDialog.module.css';

/** How a merge tool is run: its arguments, back to its own, or (one the user added) removing it. */
export function openMergeToolArgsDialog(tool: MergeTool): void {
  openDialog((close) => <MergeToolArgsDialog tool={tool} close={close} />);
}

function MergeToolArgsDialog({ tool, close }: { tool: MergeTool; close: () => void }) {
  const [text, setText] = useState(formatArgs(tool.args));
  const args = parseArgs(text);
  const problem = mergeToolArgsProblem(args);
  const save = async (): Promise<void> => {
    if (problem) return;
    if (text !== formatArgs(tool.args)) await setMergeToolArgs(tool, args);
    close();
  };
  const run = (change: () => Promise<void>) => async (): Promise<void> => {
    await change();
    close();
  };

  return (
    <Dialog
      title={`How ${tool.name} opens`}
      description={tool.executable}
      width={560}
      onClose={close}
      onSubmit={() => void save()}
      footer={
        <>
          {hasOwnArgsToGoBackTo(tool) && (
            <Button variant="ghost" onClick={() => void run(() => setMergeToolArgs(tool, null))()}>
              Back to its own arguments
            </Button>
          )}
          {tool.origin === 'custom' && (
            <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => void run(() => removeCustomMergeTool(tool.id))()}>
              Remove {tool.name}
            </Button>
          )}
          <span className={styles.footerSpace} />
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={Boolean(problem)}>
            Save
          </Button>
        </>
      }
    >
      <TextField label="Arguments" aria-label={`Arguments for ${tool.name}`} value={text} error={problem} hint={PLACEHOLDER_HINT} onChange={(event) => setText(event.target.value)} className={styles.args} autoFocus />
    </Dialog>
  );
}
