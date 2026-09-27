import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { SelectField, TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { queryClient } from '../../queryClient';
import { useRepositories, useServers, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { defaultWorkspacePath, isRepositoryNameTaken, suggestWorkspaceName } from '../workspaceNaming';
import { createRepositoryWithWorkspace } from './createRepositoryWithWorkspace';
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
  const { data: servers } = useServers();
  const { data: workspaces } = useWorkspaceList();
  const root = useDefaultWorkspaceRoot();

  const [server, setServer] = useState(initialServer);
  const [name, setName] = useState('');
  const [withWorkspace, setWithWorkspace] = useState(true);
  const [chosenPath, setChosenPath] = useState<string>();
  const [creating, setCreating] = useState(false);
  /** Created by a try whose workspace failed: trying again creates only the workspace. */
  const [created, setCreated] = useState<RepositorySummary>();
  const { data: repositories } = useRepositories(server);

  const workspaceName = suggestWorkspaceName(name.trim(), (workspaces ?? []).map((workspace) => workspace.name));
  const workspacePath = chosenPath ?? (name.trim() ? defaultWorkspacePath(root, workspaceName) : '');
  const nameTaken = !created && isRepositoryNameTaken(name, (repositories ?? []).map((repository) => repository.name));
  const canCreate = Boolean(name.trim() && !nameTaken && (!withWorkspace || workspacePath) && !creating);

  const create = async (): Promise<void> => {
    if (!canCreate) return;
    setCreating(true);
    const outcome = await createRepositoryWithWorkspace({
      created,
      createRepository: () => api.repositories.create(server, name.trim()),
      createWorkspace: withWorkspace
        ? (repository) => api.workspaces.create({ name: workspaceName, path: workspacePath, repository: repository.spec })
        : undefined,
    });
    if (outcome.kind === 'repositoryFailed') {
      toast.error("Couldn't create the repository", outcome.error);
      setCreating(false);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.repositories(server) });
    if (outcome.kind === 'workspaceFailed') {
      setCreated(outcome.repository);
      toast.error(`Created ${outcome.repository.name}, but not its workspace`, outcome.error);
      setCreating(false);
      return;
    }
    onClose();
    if (!outcome.workspace) {
      toast.success(`Created ${outcome.repository.spec}`);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    onWorkspaceCreated(outcome.workspace.path);
  };

  const chooseLocation = async (): Promise<void> => {
    const directory = await api.system.pickDirectory('Choose the workspace folder', root);
    if (directory) setChosenPath(directory);
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
      <SelectField label="Server" value={server} disabled={Boolean(created)} onChange={(event) => setServer(event.target.value)}>
        {(servers?.map((profile) => profile.server) ?? [server]).map((serverName) => (
          <option key={serverName} value={serverName}>
            {serverName}
          </option>
        ))}
      </SelectField>
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
      {withWorkspace && <LocationField path={workspacePath} onChange={setChosenPath} onChoose={() => void chooseLocation()} />}
    </Dialog>
  );
}
