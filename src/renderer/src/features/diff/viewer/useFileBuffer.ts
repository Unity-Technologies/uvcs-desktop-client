import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../../../api/client';
import { guardLeaving } from '../../../app/navigation/leaveGuard';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import type { EditorHandle } from './editorHandle';
import { bufferAfterDiscard, bufferAfterEdit, bufferAfterRead, bufferAfterSave, changedOnDisk, openedBuffer, savedAsBase, type FileBufferState } from './fileBuffer';
import { refreshFileViews, showFileText } from './fileText';
import { askAboutUnsavedEdits } from './UnsavedEditsDialog';
import type { DiffContents } from './useDiffContents';

export interface FileBuffer {
  /** The contents the diff was given: the file as read, held still while it has unsaved edits. */
  shown: DiffContents;
  /** The text typed into the diff that the disk doesn't have yet, with the file's own line breaks; null when there is none. */
  unsaved: string | null;
  /** The file changed on disk while it had unsaved edits. */
  changedOnDisk: boolean;
  /** The editor holding the text, once the diff shows it. */
  editor: RefObject<EditorHandle | null>;
  /** Takes every change of the editor's text (lone CRs shown as LFs). */
  onEdit: (text: string) => void;
  /** Writes the unsaved text; false when that failed. */
  save: () => Promise<boolean>;
  /** Drops the unsaved text for the file as it is on disk. */
  discard: () => void;
}

interface FileBufferOptions {
  workspacePath: string;
  contents: DiffContents;
  /** The workspace file typed into; null for read-only diffs. */
  path: string | null;
  /** Saving left the file as its loaded revision. */
  onMatchesBase?: () => void;
}

/**
 * The text of a workspace file typed into directly in its diff. It follows the disk while it has no unsaved edits;
 * with some, it holds still and tells when the disk changed. Leaving the file (another file, another view) asks to
 * save or discard them; should the diff go away without asking, they are saved, so no work is ever lost.
 */
export function useFileBuffer({ workspacePath, contents, path, onMatchesBase }: FileBufferOptions): FileBuffer {
  const [buffer, setBuffer] = useState(() => openedBuffer(contents));
  const editor = useRef<EditorHandle | null>(null);

  // The disk moved on: follow it, unless that would drop unsaved edits (it reached them when they were just saved).
  const read = bufferAfterRead(buffer, contents);
  if (read !== buffer) setBuffer(read);
  const { shown, unsaved } = buffer;
  const diskMovedOn = changedOnDisk(contents.right.text ?? '', buffer);

  const latest = useRef({ contents, buffer });
  latest.current = { contents, buffer };
  const update = (next: FileBufferState): void => {
    latest.current.buffer = next;
    setBuffer(next);
  };

  const save = async (): Promise<boolean> => {
    const text = latest.current.buffer.unsaved;
    if (path === null || text === null) return true;
    try {
      await api.content.writeWorkspaceFile(workspacePath, path, text);
    } catch (error) {
      toast.error(`Couldn't save ${fileNameOf(path)}`, error);
      return false;
    }
    // Typing may have gone on while it was written: that stays unsaved.
    update(bufferAfterSave(latest.current.buffer, text));
    showFileText(workspacePath, path, text);
    void refreshFileViews(workspacePath);
    if (savedAsBase(contents, text)) onMatchesBase?.();
    return true;
  };

  const discard = (): void => {
    // A newer file on disk replaces the edits as the diff follows it; otherwise the editor goes back to the saved text.
    const { buffer, editorText } = bufferAfterDiscard(latest.current.buffer, latest.current.contents);
    update(buffer);
    if (editorText !== null) editor.current?.setText(editorText);
  };

  const actions = useRef({ save, discard });
  actions.current = { save, discard };

  const dirty = unsaved !== null;
  useEffect(() => {
    if (!dirty || path === null) return;
    return guardLeaving(async () => {
      const choice = await askAboutUnsavedEdits(fileNameOf(path));
      if (choice === 'save') return actions.current.save();
      if (choice === 'discard') actions.current.discard();
      return choice !== undefined;
    });
  }, [dirty, path]);

  useEffect(
    () => () => {
      const text = latest.current.buffer.unsaved;
      if (path === null || text === null) return;
      api.content
        .writeWorkspaceFile(workspacePath, path, text)
        .then(() => refreshFileViews(workspacePath))
        .then(() => toast.success(`Saved your edits to ${fileNameOf(path)}`))
        .catch((error) => toast.error("Couldn't save your edits", error));
    },
    // Only when the diff goes away: the ref holds the latest text.
    [],
  );

  return {
    shown,
    unsaved,
    changedOnDisk: diskMovedOn,
    editor,
    onEdit: (text) => update(bufferAfterEdit(latest.current.buffer, text)),
    save,
    discard,
  };
}
