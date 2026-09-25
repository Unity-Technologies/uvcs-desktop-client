import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { RepositoryPicker } from '../../../components/RepositoryPicker';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { runOperation } from '../../operations/runOperation';
import { invalidateWorkspace, queryClient } from '../../queryClient';

interface RecreateWorkspaceOptions {
  name: string;
  path: string;
}

export function openRecreateWorkspaceDialog(options: RecreateWorkspaceOptions): void {
  openDialog((close) => <RecreateWorkspaceDialog {...options} onClose={close} />);
}

/** Creates the workspace again at its old folder and downloads the repository's files into it. */
function RecreateWorkspaceDialog({ name: initialName, path, onClose }: RecreateWorkspaceOptions & { onClose: () => void }) {
  const [repository, setRepository] = useState<RepositorySummary>();
  const [name, setName] = useState(initialName);
  const [creating, setCreating] = useState(false);
  const canCreate = Boolean(repository && name.trim() && !creating);

  const recreate = async (): Promise<void> => {
    if (!canCreate || !repository) return;
    setCreating(true);
    try {
      await api.workspaces.create({ name: name.trim(), path, repository: repository.spec });
    } catch (error) {
      toast.error("Couldn't recreate the workspace", error);
      setCreating(false);
      return;
    }
    onClose();
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    // The folder exists again: the workspace opens while its files download.
    void invalidateWorkspace(path);
    await runOperation({
      title: 'Downloading files',
      workspacePath: path,
      run: (operationId) => api.workspaces.update(path, operationId),
    });
  };

  return (
    <Dialog
      title="Recreate workspace"
      description={`A new workspace is created at ${path} and the repository's latest files are downloaded into it.`}
      width={540}
      onClose={onClose}
      onSubmit={() => void recreate()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canCreate} loading={creating}>
            Recreate
          </Button>
        </>
      }
    >
      <RepositoryPicker value={repository?.spec ?? null} onChange={setRepository} />
      <TextField label="Workspace name" value={name} onChange={(event) => setName(event.target.value)} />
    </Dialog>
  );
}
