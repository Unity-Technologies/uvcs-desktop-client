import { lastSegment } from '../../../lib/paths';
import { suggestWorkspaceName } from '../workspaceNaming';

/** Whether the New workspace dialog works with a repository that exists, or creates one along with the workspace. */
export type RepositorySource = 'existing' | 'new';

/** The repository a new workspace works with, as the dialog's choice resolves it. */
export type WorkspaceRepository =
  | { kind: 'existing'; spec: string }
  /** `created` is the spec of the repository an earlier try made before its workspace failed: only the workspace is left. */
  | { kind: 'new'; server: string; name: string; created?: string };

interface RepositoryChoice {
  source: RepositorySource;
  /** The spec of the repository picked in the list, when one is. */
  existingSpec: string | undefined;
  newServer: string;
  /** The new repository's name as typed. */
  newName: string;
  newNameTaken: boolean;
  created: string | undefined;
}

/** The repository the dialog's choice names; undefined until it names one that can be used. */
export function workspaceRepositoryOf(choice: RepositoryChoice): WorkspaceRepository | undefined {
  if (choice.source === 'existing') return choice.existingSpec ? { kind: 'existing', spec: choice.existingSpec } : undefined;
  if (choice.created) return { kind: 'new', server: choice.newServer, name: choice.newName.trim(), created: choice.created };
  const name = choice.newName.trim();
  return name && !choice.newNameTaken ? { kind: 'new', server: choice.newServer, name } : undefined;
}

/** The name of the repository the workspace is for, picked or typed; '' while there is none. */
export function chosenRepositoryName({ source, existingName, newName }: { source: RepositorySource; existingName: string | undefined; newName: string }): string {
  return source === 'existing' ? (existingName ?? '') : newName;
}

interface WorkspaceNameSources {
  /** What the user typed in the name field; undefined until they type. */
  typed: string | undefined;
  /** A folder the dialog was opened with: the workspace is named after it. */
  initialPath: string | undefined;
  /** The name of the repository chosen or being created; '' while there is none. */
  repositoryName: string;
  takenNames: readonly string[];
}

/** The workspace name the field shows: what the user typed, else the folder's name, else one after the repository. */
export function workspaceNameShown({ typed, initialPath, repositoryName, takenNames }: WorkspaceNameSources): string {
  if (typed !== undefined) return typed;
  if (initialPath) return lastSegment(initialPath);
  return repositoryName.trim() ? suggestWorkspaceName(repositoryName.trim(), takenNames) : '';
}
