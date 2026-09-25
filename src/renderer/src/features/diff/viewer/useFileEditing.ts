import { useEffect, useRef, useState } from 'react';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { toast } from '../../../ui/toast/toastStore';

interface FileEditing {
  editing: boolean;
  dirty: boolean;
  start: () => void;
  change: (text: string) => void;
  save: () => Promise<void>;
  discard: () => void;
}

/**
 * Edit session for a workspace file shown in a diff. Unsaved edits are saved when the
 * viewer goes away (e.g. another file is selected), so switching files never loses work.
 */
export function useFileEditing(workspacePath: string, path: string | null): FileEditing {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<{ path: string; text: string } | null>(null);

  const write = async (target: string, text: string): Promise<void> => {
    await api.content.writeWorkspaceFile(workspacePath, target, text);
    await queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath) });
  };

  useEffect(
    () => () => {
      const unsaved = pending.current;
      if (!unsaved) return;
      write(unsaved.path, unsaved.text)
        .then(() => toast.success(`Saved your edits to ${unsaved.path.split('/').at(-1)}`))
        .catch((error) => toast.error("Couldn't save your edits", error));
    },
    // Only on unmount: the ref always holds the latest unsaved draft.
    [],
  );

  const stop = (): void => {
    pending.current = null;
    setDraft(null);
    setEditing(false);
  };

  return {
    editing,
    dirty: draft !== null,
    start: () => setEditing(true),
    change: (text) => {
      if (!path) return;
      pending.current = { path, text };
      setDraft(text);
    },
    save: async () => {
      if (path && draft !== null) {
        try {
          await write(path, draft);
        } catch (error) {
          toast.error("Couldn't save the file", error);
          return;
        }
      }
      stop();
    },
    discard: stop,
  };
}
