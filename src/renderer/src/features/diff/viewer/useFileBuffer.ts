import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../../../api/client';
import { guardLeaving } from '../../../app/navigation/leaveGuard';
import { diskText } from '../../../lib/lineBreaks';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import type { EditorHandle } from './editorHandle';
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
  const [shown, setShown] = useState(contents);
  // The file's text on disk as far as the edits go: what was read, then what was saved.
  const [saved, setSaved] = useState(contents.right.text ?? '');
  const [unsaved, setUnsaved] = useState<string | null>(null);
  const editor = useRef<EditorHandle | null>(null);
  const onDisk = contents.right.text ?? '';

  // The disk moved on: follow it, unless that would drop unsaved edits (it reached them when they were just saved).
  if (contents !== shown && (unsaved === null || onDisk === unsaved)) {
    setShown(contents);
    setSaved(onDisk);
    setUnsaved(null);
  }
  const changedOnDisk = unsaved !== null && onDisk !== saved;

  const latest = useRef({ contents, shown, saved, unsaved });
  latest.current = { contents, shown, saved, unsaved };

  const save = async (): Promise<boolean> => {
    const text = latest.current.unsaved;
    if (path === null || text === null) return true;
    try {
      await api.content.writeWorkspaceFile(workspacePath, path, text);
    } catch (error) {
      toast.error(`Couldn't save ${fileNameOf(path)}`, error);
      return false;
    }
    // Typing may have gone on while it was written: that stays unsaved.
    latest.current.saved = text;
    setSaved(text);
    setUnsaved((current) => (current === text ? null : current));
    if (latest.current.unsaved === text) latest.current.unsaved = null;
    showFileText(workspacePath, path, text);
    void refreshFileViews(workspacePath);
    if (contents.original.kind === 'workspaceBase' && text === contents.left.text) onMatchesBase?.();
    return true;
  };

  const discard = (): void => {
    const { contents, shown, saved } = latest.current;
    latest.current.unsaved = null;
    setUnsaved(null);
    // A newer file on disk replaces the edits as the diff follows it; otherwise the editor goes back to the saved text.
    if (contents === shown) editor.current?.setText(saved);
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
      const text = latest.current.unsaved;
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
    changedOnDisk,
    editor,
    onEdit: (shown) => {
      // The editor shows a file of lone CRs with LFs: its lines keep their own line breaks, new ones take the file's.
      const text = diskText(shown, latest.current.saved);
      const next = text === latest.current.saved ? null : text;
      latest.current.unsaved = next;
      setUnsaved(next);
    },
    save,
    discard,
  };
}
