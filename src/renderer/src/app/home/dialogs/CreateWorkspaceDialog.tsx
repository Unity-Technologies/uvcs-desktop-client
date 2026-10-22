import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { splitRepositorySpec } from '../../../lib/servers';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { useRepositories, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { createNewWorkspace } from './createNewWorkspace';
import { LocationField } from './LocationField';
import { RepositoryNameCombobox } from './RepositoryNameCombobox';
import { initialRepositoryName, newWorkspaceFormOf, repositoriesToName, serverToList } from './newWorkspaceForm';

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
  const root = useDefaultWorkspaceRoot();

  const [server, setServer] = useState(() => (initialRepository ? splitRepositorySpec(initialRepository.spec).server : 'local'));
  const [repositoryName, setRepositoryName] = useState(() => initialRepositoryName(initialRepository, initialPath));
  const [created, setCreated] = useState<string>();
  const [typedName, setTypedName] = useState<string>();
  const [chosenPath, setChosenPath] = useState(initialPath);
  const [creating, setCreating] = useState(false);
  const { data: listed, error } = useRepositories(serverToList(server, initialRepository));
  const repositories = repositoriesToName(initialRepository, listed);

  const form = newWorkspaceFormOf({
    server,
    repositoryName,
    repositories,
    repositoriesFailed: Boolean(error),
    created,
    typedName,
    initialPath,
    workspaceNames: (workspaces ?? []).map((workspace) => workspace.name),
    chosenPath,
    root,
    creating,
  });

  const create = async (): Promise<void> => {
    if (!form.canCreate || !form.repository) return;
    setCreating(true);
    const outcome = await createNewWorkspace({ name: form.workspaceName.trim(), path: form.path, repository: form.repository }, (createdPath) => {
      onClose();
      onCreated(createdPath);
    });
    if (outcome.kind === 'failed') {
      if (outcome.createdRepository) setCreated(outcome.createdRepository);
      toast.error(outcome.title, outcome.error);
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
          <Button type="submit" variant="primary" disabled={!form.canCreate} loading={creating}>
            {form.createsRepository ? 'Create repository and workspace' : 'Create workspace'}
          </Button>
        </>
      }
    >
      {initialRepository ? (
        <TextField label="Repository" value={initialRepository.spec} readOnly />
      ) : (
        <RepositoryNameCombobox
          server={server}
          onServerChange={setServer}
          name={repositoryName}
          onNameChange={setRepositoryName}
          repositories={repositories}
          error={error?.message}
          form={form}
        />
      )}
      <TextField
        label="Workspace name"
        value={form.workspaceName}
        onChange={(event) => setTypedName(event.target.value)}
        error={form.workspaceNameTaken ? 'There is already a workspace with this name.' : undefined}
        autoFocus={Boolean(initialRepository)}
      />
      <LocationField path={form.path} onChange={setChosenPath} pickerTitle="Choose the workspace folder" pickerFolder={root} />
    </Dialog>
  );
}
