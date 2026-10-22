import { lastSegment } from '../../../lib/paths';
import { splitRepositorySpec } from '../../../lib/servers';
import { defaultWorkspacePath, isRepositoryNameTaken, isWorkspaceNameTaken, suggestWorkspaceName } from '../workspaceNaming';

/** Whether the New workspace dialog works with a repository that exists, or creates one along with the workspace. */
export type RepositorySource = 'existing' | 'new';

/** The repository a new workspace works with, as the dialog's choice resolves it. */
export type WorkspaceRepository =
  | { kind: 'existing'; spec: string }
  /** `created` is the spec of the repository an earlier try made before its workspace failed: only the workspace is left. */
  | { kind: 'new'; server: string; name: string; created?: string };

/** What the New workspace dialog holds: what the user chose and typed, and what it read. */
export interface NewWorkspaceFormInput {
  source: RepositorySource;
  /** The server shown, shared by both sources. */
  server: string;
  /** The repository picked in the list, when one is. */
  existing: { spec: string; name: string } | undefined;
  /** The new repository's name as typed. */
  newName: string;
  /** The names of the repositories on `server`, once read. */
  repositoryNames: readonly string[];
  /** The spec of the repository an earlier try made before its workspace failed. */
  created: string | undefined;
  /** What the user typed in the workspace name field; undefined until they type. */
  typedName: string | undefined;
  /** A folder the dialog was opened with: the workspace goes there, named after it. */
  initialPath: string | undefined;
  workspaceNames: readonly string[];
  /** A folder the user chose or typed for the workspace. */
  chosenPath: string | undefined;
  /** The folder new workspaces go in. */
  root: string | undefined;
  creating: boolean;
}

/** What the New workspace dialog shows and allows. */
export interface NewWorkspaceForm {
  /** Undefined until the choice names a repository that can be used. */
  repository: WorkspaceRepository | undefined;
  workspaceName: string;
  workspaceNameTaken: boolean;
  path: string;
  /** The new repository's name is already on the server, and no earlier try of this dialog made it. */
  showsRepositoryNameTaken: boolean;
  /** An earlier try made the repository: the choice of repository can no longer change. */
  choiceLocked: boolean;
  canCreate: boolean;
}

export function newWorkspaceFormOf(input: NewWorkspaceFormInput): NewWorkspaceForm {
  const choiceLocked = input.created !== undefined;
  const newNameTaken = !choiceLocked && isRepositoryNameTaken(input.newName, input.repositoryNames);
  const repository = repositoryOf(input, newNameTaken);
  const workspaceName = workspaceNameShown(input);
  const workspaceNameTaken = isWorkspaceNameTaken(workspaceName, input.workspaceNames);
  const path = input.chosenPath ?? defaultWorkspacePath(input.root, workspaceName);
  return {
    repository,
    workspaceName,
    workspaceNameTaken,
    path,
    showsRepositoryNameTaken: input.source === 'new' && newNameTaken,
    choiceLocked,
    canCreate: Boolean(repository && workspaceName.trim() && path && !workspaceNameTaken && !input.creating),
  };
}

/** The server whose repositories the dialog reads (to pick one, or to see a new name is free); none when the caller fixed the repository. */
export function serverToList(server: string, repositoryFixed: boolean): string | null {
  return repositoryFixed ? null : server;
}

/** What the user typed as the workspace name once they pick a repository: a pick names it afresh, unless a folder named it. */
export function typedNameAfterPicking(typedName: string | undefined, initialPath: string | undefined): string | undefined {
  return initialPath ? typedName : undefined;
}

function repositoryOf(input: NewWorkspaceFormInput, newNameTaken: boolean): WorkspaceRepository | undefined {
  if (input.source === 'existing') {
    const picked = pickedOnServer(input);
    return picked && { kind: 'existing', spec: picked.spec };
  }
  const name = input.newName.trim();
  if (input.created) return { kind: 'new', server: input.server, name, created: input.created };
  return name && !newNameTaken ? { kind: 'new', server: input.server, name } : undefined;
}

/** The repository picked counts only while its server is the one shown: the picker shows nothing picked otherwise. */
function pickedOnServer({ existing, server }: NewWorkspaceFormInput): NewWorkspaceFormInput['existing'] {
  return existing && splitRepositorySpec(existing.spec).server === server ? existing : undefined;
}

/** What the user typed, else the folder's name, else a name after the repository chosen or being created. */
function workspaceNameShown(input: NewWorkspaceFormInput): string {
  if (input.typedName !== undefined) return input.typedName;
  if (input.initialPath) return lastSegment(input.initialPath);
  const repositoryName = (input.source === 'existing' ? (pickedOnServer(input)?.name ?? '') : input.newName).trim();
  return repositoryName ? suggestWorkspaceName(repositoryName, input.workspaceNames) : '';
}
