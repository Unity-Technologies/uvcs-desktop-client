import { api } from '../../../api/client';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import { forgetDiscard, lastDiscard, recordDiscard, type Discard } from './discardHistory';
import { refreshFileViews, showFileText } from './fileText';

export interface DiscardTarget {
  workspacePath: string;
  /** The workspace file shown on the modified side. */
  path: string;
  /** The loaded revision's text, when the diff compares against it. */
  baseText: string | null;
  /** A discard brought the file back to its loaded revision. */
  onMatchesBase?: () => void;
}

/** Writes the file with some changes discarded, remembering its previous text so the discard can be undone. */
export async function discardInFile(target: DiscardTarget, discard: Discard, done: string): Promise<void> {
  if (!(await write(target, discard.after))) return;
  recordDiscard(target.workspacePath, target.path, discard);
  toast.success(`${done} in ${fileNameOf(target.path)}`, undefined, { label: 'Undo', run: () => void undoDiscard(target, discard) });
  if (discard.after === target.baseText) target.onMatchesBase?.();
}

/** Undoes the file's latest discard of this session, if any. */
export async function undoLastDiscard(target: DiscardTarget): Promise<void> {
  const discard = lastDiscard(target.workspacePath, target.path);
  if (discard) await undoDiscard(target, discard);
}

async function undoDiscard(target: DiscardTarget, discard: Discard): Promise<void> {
  const now = await api.content.read(target.workspacePath, { kind: 'workspaceFile', path: target.path });
  // Someone (an agent, an editor, a later discard) wrote the file since: putting the old text back would lose that.
  if (now.text !== discard.after) {
    toast.info(`${fileNameOf(target.path)} changed since`, 'Nothing was undone, so the newer changes stay.');
    return;
  }
  if (await write(target, discard.before)) forgetDiscard(target.workspacePath, target.path, discard);
}

/** Shows the new text right away, then writes it and re-reads what depends on the file. */
async function write({ workspacePath, path }: DiscardTarget, text: string): Promise<boolean> {
  showFileText(workspacePath, path, text);
  try {
    await api.content.writeWorkspaceFile(workspacePath, path, text);
    return true;
  } catch (error) {
    toast.error(`Couldn't write ${fileNameOf(path)}`, error);
    return false;
  } finally {
    await refreshFileViews(workspacePath);
  }
}
