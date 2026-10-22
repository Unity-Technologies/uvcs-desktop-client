import { useState } from 'react';
import { ServerSelect } from '../../../components/ServerSelect';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { useRepositories, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { defaultWorkspacePath, isRepositoryNameTaken, suggestWorkspaceName } from '../workspaceNaming';
import { createNewRepository } from './createNewRepository';
import { LocationField } from './LocationField';

interface CreateRepositoryOptions {
  server: string;
  /** Called with the new workspace path when the user also asked for a workspace. */
  onWorkspaceCreated: (workspacePath: string) => void;
}

export function openCreateRepositoryDialog(options: CreateRepositoryOptions): void {
  openDialog((close) => <CreateRepositoryDialog {...options} onClose={close} />);
}

function CreateRepositoryDialog({ server: initialServer, onWorkspaceCreated, onClose }: CreateRepositoryOptions & { onClose: () => void }) {
  const { data: workspaces } = useWorkspaceList();
  const root = useDefaultWorkspaceRoot();

  const [server, setServer] = useState(initialServer);
  const [name, setName] = useState('');
  const [withWorkspace, setWithWorkspace] = useState(true);
  const [chosenPath, setChosenPath] = useState<string>();
  const [creating, setCreating] = useState(false);
  /** Created by a try whose workspace failed: trying again creates only the workspace. */
  const [created, setCreated] = useState<string>();
  const { data: repositories } = useRepositories(server);

  const workspaceName = suggestWorkspaceName(name.trim(), (workspaces ?? []).map((workspace) => workspace.name));
  const workspacePath = chosenPath ?? (name.trim() ? defaultWorkspacePath(root, workspaceName) : '');
  const nameTaken = !created && isRepositoryNameTaken(name, (repositories ?? []).map((repository) => repository.name));
  const canCreate = Boolean(name.trim() && !nameTaken && (!withWorkspace || workspacePath) && !creating);

  const create = async (): Promise<void> => {
    if (!canCreate) return;
    setCreating(true);
    const outcome = await createNewRepository({
      server,
      name: name.trim(),
      created,
      workspace: withWorkspace ? { name: workspaceName, path: workspacePath } : undefined,
    });
    if (outcome.kind === 'failed') {
      if (outcome.createdRepository) setCreated(outcome.createdRepository);
      toast.error(outcome.title, outcome.error);
      setCreating(false);
      return;
    }
    onClose();
    if (outcome.workspace) onWorkspaceCreated(outcome.workspace.path);
    else toast.success(`Created ${outcome.repositorySpec}`);
  };

  return (
    <Dialog
      title="New repository"
      width={540}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canCreate} loading={creating}>
            {created ? 'Create workspace' : 'Create repository'}
          </Button>
        </>
      }
    >
      <ServerSelect value={server} onChange={setServer} disabled={Boolean(created)} />
      <TextField
        label="Repository name"
        value={name}
        readOnly={Boolean(created)}
        error={nameTaken ? 'There is already a repository with this name.' : undefined}
        onChange={(event) => setName(event.target.value)}
        autoFocus
      />
      {!created && (
        <Checkbox label="Also create a workspace to start working right away" checked={withWorkspace} onChange={setWithWorkspace} />
      )}
      {withWorkspace && <LocationField path={workspacePath} onChange={setChosenPath} pickerTitle="Choose the workspace folder" pickerFolder={root} />}
    </Dialog>
  );
}
