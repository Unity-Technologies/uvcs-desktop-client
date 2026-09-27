import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { RepositoryPicker } from '../../../components/RepositoryPicker';
import { lastSegment } from '../../../lib/paths';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { queryClient } from '../../queryClient';
import { useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { defaultWorkspacePath, isWorkspaceNameTaken, suggestWorkspaceName } from '../workspaceNaming';
import { LocationField } from './LocationField';

interface CreateWorkspaceOptions {
  repository?: RepositorySummary;
  /** A folder the user already chose, e.g. by dropping it on the window. */
  path?: string;
  onCreated: (workspacePath: string) => void;
}

export function openCreateWorkspaceDialog(options: CreateWorkspaceOptions): void {
  openDialog((close) => <CreateWorkspaceDialog {...options} onClose={close} />);
}

function CreateWorkspaceDialog({ repository: initialRepository, path: initialPath, onCreated, onClose }: CreateWorkspaceOptions & { onClose: () => void }) {
  const { data: workspaces } = useWorkspaceList();
  const takenNames = (workspaces ?? []).map((workspace) => workspace.name);
  const root = useDefaultWorkspaceRoot();

  const [repository, setRepository] = useState<RepositorySummary | undefined>(initialRepository);
  const [name, setName] = useState(() => {
    if (initialPath) return lastSegment(initialPath);
    return initialRepository ? suggestWorkspaceName(initialRepository.name, takenNames) : '';
  });
  const [chosenPath, setChosenPath] = useState(initialPath);
  const [creating, setCreating] = useState(false);

  const path = chosenPath ?? defaultWorkspacePath(root, name);
  const nameTaken = isWorkspaceNameTaken(name, takenNames);
  const canCreate = Boolean(repository && name.trim() && path && !nameTaken && !creating);

  const pickRepository = (picked: RepositorySummary): void => {
    setRepository(picked);
    if (!initialPath) setName(suggestWorkspaceName(picked.name, takenNames));
  };

  const chooseLocation = async (): Promise<void> => {
    const directory = await api.system.pickDirectory('Choose the workspace folder', root);
    if (directory) setChosenPath(directory);
  };

  const create = async (): Promise<void> => {
    if (!canCreate || !repository) return;
    setCreating(true);
    try {
      const created = await api.workspaces.create({ name: name.trim(), path, repository: repository.spec });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      onClose();
      onCreated(created.path);
    } catch (error) {
      toast.error("Couldn't create the workspace", error);
      setCreating(false);
    }
  };

  return (
    <Dialog
      title="New workspace"
      description="A workspace is a folder on your computer where you work with a repository's files."
      width={540}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canCreate} loading={creating}>
            Create workspace
          </Button>
        </>
      }
    >
      {initialRepository ? (
        <TextField label="Repository" value={initialRepository.spec} readOnly />
      ) : (
        <RepositoryPicker value={repository?.spec ?? null} onChange={pickRepository} />
      )}
      <TextField
        label="Workspace name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameTaken ? 'There is already a workspace with this name.' : undefined}
        autoFocus={Boolean(initialRepository)}
      />
      <LocationField path={path} onChange={setChosenPath} onChoose={() => void chooseLocation()} />
    </Dialog>
  );
}
