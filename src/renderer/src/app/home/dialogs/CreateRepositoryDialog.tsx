import { useMemo, useState } from 'react';
import type { UnityProject } from '@shared/domain/repository';
import { ServerSelect } from '../../../components/ServerSelect';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { SelectField, TextField } from '../../../ui/TextField';
import { toast } from '../../../ui/toast/toastStore';
import { useProjects, useRepositories, useWorkspaceList } from '../../workspace/workspaceQueries';
import { useDefaultWorkspaceRoot } from '../useDefaultWorkspaceRoot';
import { defaultWorkspacePath, suggestWorkspaceName } from '../workspaceNaming';
import { createNewRepository } from './createNewRepository';
import { initialProject, newRepositoryOf } from './newRepositoryForm';
import { LocationField } from './LocationField';

interface CreateRepositoryOptions {
  server: string;
  /** The Unity project the repositories list shows, which the repository is created in unless another is picked. */
  project?: string | null;
  /** Called with the new workspace path when the user also asked for a workspace. */
  onWorkspaceCreated: (workspacePath: string) => void;
}

const NO_PROJECTS: UnityProject[] = [];

export function openCreateRepositoryDialog(options: CreateRepositoryOptions): void {
  openDialog((close) => <CreateRepositoryDialog {...options} onClose={close} />);
}

function CreateRepositoryDialog({ server: initialServer, project: shownProject, onWorkspaceCreated, onClose }: CreateRepositoryOptions & { onClose: () => void }) {
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
  const { data: projects = NO_PROJECTS } = useProjects(server);
  const projectNames = useMemo(() => projects.map((listed) => listed.name), [projects]);
  // Undefined until picked: the dialog starts on the project the list shows, once the server's projects are read.
  const [pickedProject, setPickedProject] = useState<string | null>();
  const project = pickedProject === undefined ? initialProject(shownProject, projectNames) : pickedProject;
  const repository = newRepositoryOf({ name, project, projects: projectNames, takenNames: (repositories ?? []).map((listed) => listed.name) });

  const workspaceName = suggestWorkspaceName(name.trim(), (workspaces ?? []).map((workspace) => workspace.name));
  const workspacePath = chosenPath ?? (name.trim() ? defaultWorkspacePath(root, workspaceName) : '');
  const nameTaken = !created && repository.nameTaken;
  const canCreate = Boolean(name.trim() && !nameTaken && !repository.needsProject && (!withWorkspace || workspacePath) && !creating);
  const changeServer = (next: string): void => {
    setServer(next);
    setPickedProject(undefined);
  };

  const create = async (): Promise<void> => {
    if (!canCreate) return;
    setCreating(true);
    const outcome = await createNewRepository({
      server,
      name: repository.fullName,
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
      <ServerSelect value={server} onChange={changeServer} disabled={Boolean(created)} />
      {repository.asksProject && (
        <SelectField label="Project" value={project ?? ''} disabled={Boolean(created)} onChange={(event) => setPickedProject(event.target.value || null)}>
          <option value="" disabled>
            Choose a project
          </option>
          {projectNames.map((projectName) => (
            <option key={projectName} value={projectName}>
              {projectName}
            </option>
          ))}
        </SelectField>
      )}
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
