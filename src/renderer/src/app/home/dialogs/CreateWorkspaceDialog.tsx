import type { WorkspaceKind } from '@shared/domain/workspace';
import { useState } from 'react';
import { api } from '../../../api/client';
import { splitRepositorySpec } from '../../../lib/servers';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { useCanCreateDynamicWorkspaces, useRepositories, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { createNewWorkspace } from './createNewWorkspace';
import styles from './HomeDialogs.module.css';
import { LocationField } from './LocationField';
import { RepositoryNameCombobox } from './RepositoryNameCombobox';
import { DYNAMIC_WORKSPACES_URL, initialRepositoryName, newWorkspaceFormOf, repositoriesToName, serverToList, toggledKind, type NamedRepository } from './newWorkspaceForm';

interface CreateWorkspaceOptions {
  repository?: NamedRepository;
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
  const [kindChosen, setKindChosen] = useState<WorkspaceKind>('standard');
  const [creating, setCreating] = useState(false);
  const { data: dynamicAvailable = false } = useCanCreateDynamicWorkspaces();
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
    dynamicAvailable,
    kindChosen,
    creating,
  });

  const create = async (): Promise<void> => {
    if (!form.canCreate || !form.repository) return;
    setCreating(true);
    const outcome = await createNewWorkspace({ name: form.workspaceName.trim(), path: form.path, repository: form.repository, kind: form.kind }, (createdPath) => {
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
      {form.offersPartial && (
        <Checkbox
          label="Download only the folders and files I choose"
          checked={form.partial}
          onChange={(checked) => setKindChosen((current) => toggledKind(current, 'partial', checked))}
        />
      )}
      {form.offersDynamic && (
        <div className={styles.choiceRow}>
          <Checkbox label="Make this workspace dynamic (alpha)" checked={form.dynamic} onChange={(checked) => setKindChosen((current) => toggledKind(current, 'dynamic', checked))} />
          <Button variant="ghost" size="small" onClick={() => void api.system.openExternal(DYNAMIC_WORKSPACES_URL)}>
            Learn more
          </Button>
        </div>
      )}
    </Dialog>
  );
}
