import { api } from '../../../api/client';
import { workspaceKey } from '../../../api/queryKeys';
import { refreshQueries } from '../../../app/refresh/refreshQueries';
import { isAffectedByFileChanges } from '../../../app/refresh/refreshScopes';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';

export interface BlockRevertOptions {
  workspacePath: string;
  /** The workspace file shown on the modified side. */
  path: string;
  /** Its text as shown, kept to undo the revert. */
  currentText: string;
  /** The loaded revision's text, when the diff compares against it. */
  baseText: string | null;
  /** The last block was reverted: the file is back to its loaded revision. */
  onMatchesBase?: () => void;
}

/** Writes the file with a block reverted (`reverted`), with a toast to undo it. */
export async function revertBlock({ workspacePath, path, currentText, baseText, onMatchesBase }: BlockRevertOptions, reverted: string): Promise<void> {
  const name = fileNameOf(path);

  const write = async (text: string): Promise<boolean> => {
    try {
      await api.content.writeWorkspaceFile(workspacePath, path, text);
    } catch (error) {
      toast.error(`Couldn't write ${name}`, error);
      return false;
    }
    // Also with auto refresh off: this was the user's own action.
    await refreshQueries({ queryKey: workspaceKey(workspacePath), predicate: ({ queryKey }) => isAffectedByFileChanges(queryKey) });
    return true;
  };

  const undo = async (reverted: string): Promise<void> => {
    const now = await api.content.read(workspacePath, { kind: 'workspaceFile', path });
    // Someone (an agent, an editor) wrote the file since: putting the old text back would lose their change.
    if (now.text !== reverted) {
      toast.info(`${name} changed since the revert`, 'Nothing was undone, so the newer changes stay.');
      return;
    }
    await write(currentText);
  };

  if (!(await write(reverted))) return;
  toast.success(`Reverted a block in ${name}`, undefined, { label: 'Undo', run: () => void undo(reverted) });
  if (reverted === baseText) onMatchesBase?.();
}
