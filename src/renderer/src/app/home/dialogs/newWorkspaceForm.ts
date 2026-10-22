import type { RepositorySummary } from '@shared/domain/repository';
import { lastSegment } from '../../../lib/paths';
import { defaultWorkspacePath, isWorkspaceNameTaken, repositoryNamed, repositoryNamedButForCase, suggestWorkspaceName } from '../workspaceNaming';

/** The repository a new workspace works with, as the dialog's Repository field resolves it. */
export type WorkspaceRepository =
  | { kind: 'existing'; spec: string }
  /** `created` is the spec of the repository an earlier try made before its workspace failed: only the workspace is left. */
  | { kind: 'new'; server: string; name: string; created?: string };

/** What the New workspace dialog holds: what the user chose and typed, and what it read. */
export interface NewWorkspaceFormInput {
  server: string;
  /** The Repository field as typed or picked from its suggestions. */
  repositoryName: string;
  /** The repositories on `server`; undefined until read. */
  repositories: readonly RepositorySummary[] | undefined;
  /** Reading the repositories on `server` failed. */
  repositoriesFailed: boolean;
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
  /** Undefined until the Repository field names one that can be used. */
  repository: WorkspaceRepository | undefined;
  /** Whether the server's repositories, which the Repository field suggests, are being read, couldn't be, or are. */
  repositoryList: 'loading' | 'failed' | 'ready';
  /** The name typed is none of the server's repositories: one is created with the workspace. */
  createsRepository: boolean;
  /** What the Repository field notes under it: a repository will be created, or one is named like it but for case. */
  repositoryNote: { kind: 'creates' } | { kind: 'differsByCase'; existingName: string } | undefined;
  /** An earlier try made the repository: the server and repository can no longer change. */
  repositoryLocked: boolean;
  workspaceName: string;
  workspaceNameTaken: boolean;
  path: string;
  canCreate: boolean;
}

export function newWorkspaceFormOf(input: NewWorkspaceFormInput): NewWorkspaceForm {
  const repository = repositoryOf(input);
  const workspaceName = workspaceNameShown(input);
  const workspaceNameTaken = isWorkspaceNameTaken(workspaceName, input.workspaceNames);
  const path = input.chosenPath ?? defaultWorkspacePath(input.root, workspaceName);
  const createsRepository = repository?.kind === 'new' && !repository.created;
  return {
    repository,
    repositoryList: input.repositoriesFailed ? 'failed' : input.repositories ? 'ready' : 'loading',
    createsRepository,
    repositoryNote: createsRepository ? noteOnCreating(input) : undefined,
    repositoryLocked: input.created !== undefined,
    workspaceName,
    workspaceNameTaken,
    path,
    canCreate: Boolean(repository && workspaceName.trim() && path && !workspaceNameTaken && !input.creating),
  };
}

/** The server whose repositories the dialog reads (to suggest them, and to tell a new name); none when the caller fixed the repository. */
export function serverToList(server: string, fixed: RepositorySummary | undefined): string | null {
  return fixed ? null : server;
}

/** The repositories the Repository field can name: the one the caller fixed, else the server's as read. */
export function repositoriesToName(fixed: RepositorySummary | undefined, listed: readonly RepositorySummary[] | undefined): readonly RepositorySummary[] | undefined {
  return fixed ? [fixed] : listed;
}

/**
 * A name the server has is that repository; any other is one to create. `cm` tells repository names apart by case, so
 * only the exact name matches. Until the list is read nothing can be told, so nothing is named.
 */
function repositoryOf({ server, repositoryName, repositories, created }: NewWorkspaceFormInput): WorkspaceRepository | undefined {
  const name = repositoryName.trim();
  if (created) return { kind: 'new', server, name, created };
  if (!name || !repositories) return undefined;
  const existing = repositoryNamed(name, repositories);
  return existing ? { kind: 'existing', spec: existing.spec } : { kind: 'new', server, name };
}

/** A name that differs only by case from a repository's is likely a slip: it is told apart from a plainly new name. */
function noteOnCreating({ repositoryName, repositories }: NewWorkspaceFormInput): NewWorkspaceForm['repositoryNote'] {
  const lookalike = repositoryNamedButForCase(repositoryName, repositories ?? []);
  return lookalike ? { kind: 'differsByCase', existingName: lookalike.name } : { kind: 'creates' };
}

/** What the user typed, else the folder's name, else a name after the repository. */
function workspaceNameShown({ typedName, initialPath, repositoryName, workspaceNames }: NewWorkspaceFormInput): string {
  if (typedName !== undefined) return typedName;
  if (initialPath) return lastSegment(initialPath);
  const name = repositoryName.trim();
  return name ? suggestWorkspaceName(name, workspaceNames) : '';
}
