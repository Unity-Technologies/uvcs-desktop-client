import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { RepositoryPicker } from '../../../components/RepositoryPicker';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { useRepositories, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { defaultWorkspacePath, isRepositoryNameTaken, isWorkspaceNameTaken } from '../workspaceNaming';
import { createNewWorkspace } from './createNewWorkspace';
import { LocationField } from './LocationField';
import { NewRepositoryFields } from './NewRepositoryFields';
import { chosenRepositoryName, workspaceNameShown, workspaceRepositoryOf, type RepositorySource } from './newWorkspaceForm';

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

  const [source, setSource] = useState<RepositorySource>('existing');
  const [existing, setExisting] = useState<RepositorySummary | undefined>(initialRepository);
  const [newServer, setNewServer] = useState('local');
  const [newName, setNewName] = useState('');
  /** Created by a try whose workspace failed: trying again creates only the workspace. */
  const [created, setCreated] = useState<string>();
  const [typedName, setTypedName] = useState<string>();
  const [chosenPath, setChosenPath] = useState(initialPath);
  const [creating, setCreating] = useState(false);
  const { data: newServerRepositories } = useRepositories(source === 'new' ? newServer : null);

  const newNameTaken = isRepositoryNameTaken(newName, (newServerRepositories ?? []).map((repository) => repository.name));
  const repository = workspaceRepositoryOf({ source, existingSpec: existing?.spec, newServer, newName, newNameTaken, created });
  const repositoryName = chosenRepositoryName({ source, existingName: existing?.name, newName });
  const name = workspaceNameShown({ typed: typedName, initialPath, repositoryName, takenNames });
  const path = chosenPath ?? defaultWorkspacePath(root, name);
  const nameTaken = isWorkspaceNameTaken(name, takenNames);
  const canCreate = Boolean(repository && name.trim() && path && !nameTaken && !creating);

  const pickExisting = (picked: RepositorySummary): void => {
    setExisting(picked);
    // A repository picked names the workspace afresh, unless a dropped folder named it.
    if (!initialPath) setTypedName(undefined);
  };

  const create = async (): Promise<void> => {
    if (!canCreate || !repository) return;
    setCreating(true);
    const outcome = await createNewWorkspace({ name: name.trim(), path, repository }, (createdPath) => {
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
          <Button type="submit" variant="primary" disabled={!canCreate} loading={creating}>
            Create workspace
          </Button>
        </>
      }
    >
      {initialRepository ? (
        <TextField label="Repository" value={initialRepository.spec} readOnly />
      ) : (
        <>
          {!created && (
            <SegmentedControl<RepositorySource>
              label="Repository"
              value={source}
              onChange={setSource}
              stretch
              segments={[
                { value: 'existing', label: 'Existing repository' },
                { value: 'new', label: 'New repository' },
              ]}
            />
          )}
          {source === 'existing' ? (
            <RepositoryPicker value={existing?.spec ?? null} onChange={pickExisting} />
          ) : (
            <NewRepositoryFields
              server={newServer}
              onServerChange={setNewServer}
              name={newName}
              onNameChange={setNewName}
              nameTaken={!created && newNameTaken}
              locked={Boolean(created)}
            />
          )}
        </>
      )}
      <TextField
        label="Workspace name"
        value={name}
        onChange={(event) => setTypedName(event.target.value)}
        error={nameTaken ? 'There is already a workspace with this name.' : undefined}
        autoFocus={Boolean(initialRepository)}
      />
      <LocationField path={path} onChange={setChosenPath} pickerTitle="Choose the workspace folder" pickerFolder={root} />
    </Dialog>
  );
}
