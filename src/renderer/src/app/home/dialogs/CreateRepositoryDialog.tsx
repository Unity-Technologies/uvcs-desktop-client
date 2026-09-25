import { useState } from 'react';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { joinPath } from '../../../lib/paths';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { SelectField, TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { queryClient } from '../../queryClient';
import { useServers, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { suggestWorkspaceName } from '../workspaceNaming';
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

  const workspaceName = suggestWorkspaceName(name.trim(), (workspaces ?? []).map((workspace) => workspace.name));
  const workspacePath = chosenPath ?? (root && name.trim() ? joinPath(root, workspaceName) : '');
  const canCreate = Boolean(name.trim() && (!withWorkspace || workspacePath) && !creating);

  const create = async (): Promise<void> => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const repository = await api.repositories.create(server, name.trim());
      void queryClient.invalidateQueries({ queryKey: queryKeys.repositories(server) });
      if (!withWorkspace) {
        toast.success(`Created ${repository.spec}`);
        onClose();
        return;
      }
      const workspace = await api.workspaces.create({ name: workspaceName, path: workspacePath, repository: repository.spec });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      onClose();
      onWorkspaceCreated(workspace.path);
    } catch (error) {
      toast.error("Couldn't create the repository", error);
      setCreating(false);
    }
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
            Create repository
          </Button>
        </>
      }
    >
      <SelectField label="Server" value={server} onChange={(event) => setServer(event.target.value)}>
        {(servers?.map((profile) => profile.server) ?? [server]).map((serverName) => (
          <option key={serverName} value={serverName}>
            {serverName}
          </option>
        ))}
      </SelectField>
      <TextField label="Repository name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      <Checkbox label="Also create a workspace to start working right away" checked={withWorkspace} onChange={setWithWorkspace} />
      {withWorkspace && <LocationField path={workspacePath} onChange={setChosenPath} onChoose={() => void chooseLocation()} />}
    </Dialog>
  );
}
